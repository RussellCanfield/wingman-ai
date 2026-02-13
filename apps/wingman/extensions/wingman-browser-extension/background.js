const DEFAULT_RELAY_PORT = 18792;
const RELAY_HOST = "127.0.0.1";
const CONNECT_TIMEOUT_MS = 5000;
const HEALTHCHECK_TIMEOUT_MS = 1500;

const BADGE = {
  attached: { text: "WM", color: "#2563eb" },
  connecting: { text: "..", color: "#d97706" },
  error: { text: "!", color: "#dc2626" },
  idle: { text: "", color: "#000000" },
};

let relaySocket = null;
let relayConnectPromise = null;

const attachedTabs = new Map();
const sessionToTab = new Map();

let debuggerListenersInstalled = false;

function clampPort(rawValue) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return DEFAULT_RELAY_PORT;
  }
  return parsed;
}

async function getRelayPort() {
  const { relayPort } = await chrome.storage.local.get(["relayPort"]);
  return clampPort(relayPort);
}

async function getRelayToken() {
  const { relayToken } = await chrome.storage.local.get(["relayToken"]);
  if (typeof relayToken !== "string") return "";
  return relayToken.trim();
}

function getRelayHttpBase(port) {
  return `http://${RELAY_HOST}:${port}`;
}

function getRelayWsUrl(port, token) {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return `ws://${RELAY_HOST}:${port}/extension${query}`;
}

function setBadge(tabId, state) {
  const config = BADGE[state] || BADGE.idle;
  void chrome.action.setBadgeText({ tabId, text: config.text });
  void chrome.action.setBadgeBackgroundColor({ tabId, color: config.color });
  void chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" }).catch(() =>
    undefined,
  );
}

function setActionTitle(tabId, title) {
  void chrome.action.setTitle({ tabId, title }).catch(() => undefined);
}

async function checkRelayHealth(port) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);
  try {
    const response = await fetch(`${getRelayHttpBase(port)}/`, {
      method: "HEAD",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`relay health check returned HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function sendRelay(payload) {
  if (!relaySocket || relaySocket.readyState !== WebSocket.OPEN) {
    throw new Error("relay socket is not connected");
  }
  relaySocket.send(JSON.stringify(payload));
}

function handleSocketClosed(reason) {
  relaySocket = null;
  console.debug("Wingman relay socket closed:", reason);

  for (const tabId of attachedTabs.keys()) {
    setBadge(tabId, "error");
    setActionTitle(tabId, "Wingman Relay disconnected (click to reconnect)");
  }
}

function installSocketHandlers(socket) {
  socket.onmessage = (event) => {
    void handleRelayMessage(String(event.data || ""));
  };
  socket.onclose = (event) => {
    handleSocketClosed(`code=${event.code}`);
  };
  socket.onerror = () => {
    handleSocketClosed("websocket error");
  };
}

function ensureDebuggerListeners() {
  if (debuggerListenersInstalled) {
    return;
  }
  debuggerListenersInstalled = true;
  chrome.debugger.onEvent.addListener(onDebuggerEvent);
  chrome.debugger.onDetach.addListener(onDebuggerDetach);
}

async function ensureRelayConnection() {
  if (relaySocket && relaySocket.readyState === WebSocket.OPEN) {
    return;
  }

  if (relayConnectPromise) {
    await relayConnectPromise;
    return;
  }

  relayConnectPromise = (async () => {
    const relayPort = await getRelayPort();
    const relayToken = await getRelayToken();
    if (!relayToken) {
      throw new Error(
        "Relay token is not configured. Run `wingman browser extension pair` and set the token in extension options.",
      );
    }
    await checkRelayHealth(relayPort);

    const wsUrl = getRelayWsUrl(relayPort, relayToken);
    const socket = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("relay websocket connection timed out"));
      }, CONNECT_TIMEOUT_MS);

      socket.onopen = () => {
        try {
          socket.send(
            JSON.stringify({
              method: "hello",
              params: {
                token: relayToken,
                clientType: "extension",
                version: chrome.runtime.getManifest().version,
              },
            }),
          );
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      };

      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(String(event.data || ""));
        } catch {
          return;
        }
        if (message?.method === "hello_ack") {
          clearTimeout(timeout);
          resolve();
        }
      };

      socket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("relay websocket connection failed"));
      };

      socket.onclose = (event) => {
        clearTimeout(timeout);
        reject(new Error(`relay websocket closed before open (code=${event.code})`));
      };
    });

    relaySocket = socket;
    installSocketHandlers(socket);
    ensureDebuggerListeners();
  })();

  try {
    await relayConnectPromise;
  } finally {
    relayConnectPromise = null;
  }
}

function buildSessionId(tabId) {
  return `wm-tab-${tabId}-${Date.now().toString(36)}`;
}

async function attachTab(tabId) {
  if (attachedTabs.has(tabId)) {
    return attachedTabs.get(tabId);
  }

  setBadge(tabId, "connecting");
  setActionTitle(tabId, "Wingman Relay connecting...");

  const debuggee = { tabId };
  await chrome.debugger.attach(debuggee, "1.3");

  try {
    await chrome.debugger.sendCommand(debuggee, "Page.enable");
  } catch {
    // Some pages deny Page domain. Continue.
  }

  const info = await chrome.debugger.sendCommand(debuggee, "Target.getTargetInfo");
  const targetId = String(info?.targetInfo?.targetId || "").trim();
  if (!targetId) {
    throw new Error("Target.getTargetInfo returned no targetId");
  }

  const sessionId = buildSessionId(tabId);
  const tabState = { sessionId, targetId };
  attachedTabs.set(tabId, tabState);
  sessionToTab.set(sessionId, tabId);

  sendRelay({
    method: "forwardCDPEvent",
    params: {
      method: "Target.attachedToTarget",
      params: {
        sessionId,
        targetInfo: {
          targetId,
          type: "page",
          attached: true,
        },
        waitingForDebugger: false,
      },
    },
  });

  setBadge(tabId, "attached");
  setActionTitle(tabId, "Wingman Relay attached (click to detach)");

  return tabState;
}

async function detachTab(tabId, reason = "manual-detach") {
  const state = attachedTabs.get(tabId);
  if (!state) {
    setBadge(tabId, "idle");
    setActionTitle(tabId, "Wingman Relay (click to attach)");
    return;
  }

  attachedTabs.delete(tabId);
  sessionToTab.delete(state.sessionId);

  try {
    sendRelay({
      method: "forwardCDPEvent",
      params: {
        method: "Target.detachedFromTarget",
        params: {
          sessionId: state.sessionId,
          targetId: state.targetId,
          reason,
        },
      },
    });
  } catch {
    // Ignore relay disconnects during detach.
  }

  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // Detach may fail if Chrome already detached.
  }

  setBadge(tabId, "idle");
  setActionTitle(tabId, "Wingman Relay (click to attach)");
}

async function toggleTab(tabId) {
  if (attachedTabs.has(tabId)) {
    await detachTab(tabId, "toggle");
    return;
  }

  try {
    await ensureRelayConnection();
    await attachTab(tabId);
  } catch (error) {
    setBadge(tabId, "error");
    setActionTitle(tabId, "Wingman Relay unavailable (open extension options)");
    await chrome.runtime.openOptionsPage().catch(() => undefined);
    throw error;
  }
}

async function forwardCdpCommand(command) {
  const sessionId = String(command?.params?.sessionId || "").trim();
  const method = String(command?.params?.method || "").trim();
  const params = command?.params?.params || {};

  if (!sessionId || !method) {
    throw new Error("forwardCDPCommand missing sessionId or method");
  }

  const tabId = sessionToTab.get(sessionId);
  if (!tabId) {
    throw new Error(`unknown sessionId: ${sessionId}`);
  }

  return chrome.debugger.sendCommand({ tabId }, method, params);
}

async function handleRelayMessage(rawMessage) {
  let message;
  try {
    message = JSON.parse(rawMessage);
  } catch {
    return;
  }

  if (message?.method === "ping") {
    sendRelay({ method: "pong" });
    return;
  }

  if (
    typeof message?.id === "number" &&
    message?.method === "forwardCDPCommand"
  ) {
    try {
      const result = await forwardCdpCommand(message);
      sendRelay({ id: message.id, result });
    } catch (error) {
      sendRelay({
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function sendDebuggerEventToRelay(tabId, method, params) {
  const tabState = attachedTabs.get(tabId);
  if (!tabState) {
    return;
  }

  try {
    sendRelay({
      method: "forwardCDPEvent",
      params: {
        method,
        params: {
          sessionId: tabState.sessionId,
          targetId: tabState.targetId,
          ...params,
        },
      },
    });
  } catch {
    // Relay may be disconnected. Ignore here.
  }
}

function onDebuggerEvent(debuggee, method, params) {
  const tabId = debuggee?.tabId;
  if (typeof tabId !== "number") {
    return;
  }
  sendDebuggerEventToRelay(tabId, method, params || {});
}

function onDebuggerDetach(debuggee, reason) {
  const tabId = debuggee?.tabId;
  if (typeof tabId !== "number") {
    return;
  }
  void detachTab(tabId, reason || "debugger-detached");
}

chrome.action.onClicked.addListener((tab) => {
  const tabId = tab?.id;
  if (typeof tabId !== "number") {
    return;
  }
  void toggleTab(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (!attachedTabs.has(tabId)) {
    return;
  }
  void detachTab(tabId, "tab-closed");
});

chrome.runtime.onSuspend.addListener(() => {
  for (const tabId of attachedTabs.keys()) {
    void chrome.debugger.detach({ tabId }).catch(() => undefined);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const relayPort = await getRelayPort();
  const relayToken = await getRelayToken();
  await chrome.storage.local.set({ relayPort, relayToken });
});
