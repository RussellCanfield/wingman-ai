const DEFAULT_RELAY_PORT = 18792;

function clampPort(rawValue) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return DEFAULT_RELAY_PORT;
  }
  return parsed;
}

function getRelayUrl(port) {
  return `http://127.0.0.1:${port}/`;
}

function setStatus(message, level = "info") {
  const element = document.getElementById("status");
  if (!element) return;
  element.textContent = message;
  element.dataset.level = level;
}

function updateRelayUrl(port) {
  const element = document.getElementById("relay-url");
  if (!element) return;
  element.textContent = getRelayUrl(port);
}

async function testRelay(port) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000);
  try {
    const response = await fetch(getRelayUrl(port), {
      method: "HEAD",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    setStatus(`Relay is reachable at ${getRelayUrl(port)}`, "ok");
  } catch {
    setStatus(
      `Relay is not reachable at ${getRelayUrl(port)}. Start Wingman gateway/browser relay and try again.`,
      "error",
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function loadSettings() {
  const { relayPort, relayToken } = await chrome.storage.local.get([
    "relayPort",
    "relayToken",
  ]);
  const port = clampPort(relayPort);
  const portInput = document.getElementById("relay-port");
  if (portInput) {
    portInput.value = String(port);
  }
  const tokenInput = document.getElementById("relay-token");
  if (tokenInput) {
    tokenInput.value = typeof relayToken === "string" ? relayToken : "";
  }
  updateRelayUrl(port);
  if (!tokenInput?.value.trim()) {
    setStatus(
      "Relay token is empty. Run `wingman browser extension pair` and paste the token.",
      "error",
    );
    return;
  }
  await testRelay(port);
}

async function saveSettings() {
  const portInput = document.getElementById("relay-port");
  const tokenInput = document.getElementById("relay-token");
  const port = clampPort(portInput?.value);
  const relayToken = String(tokenInput?.value || "").trim();
  await chrome.storage.local.set({ relayPort: port, relayToken });
  if (portInput) {
    portInput.value = String(port);
  }
  if (tokenInput) {
    tokenInput.value = relayToken;
  }
  updateRelayUrl(port);
  if (!relayToken) {
    setStatus("Saved, but relay token is empty.", "error");
    return;
  }
  await testRelay(port);
}

document.getElementById("save")?.addEventListener("click", () => {
  void saveSettings();
});

document.getElementById("test")?.addEventListener("click", () => {
  const input = document.getElementById("relay-port");
  const port = clampPort(input?.value);
  updateRelayUrl(port);
  void testRelay(port);
});

void loadSettings();
