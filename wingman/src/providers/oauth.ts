import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { URL, URLSearchParams } from "node:url";
import {
	getProviderSpec,
	type ProviderName,
	type ProviderOAuthConfig,
} from "./registry.js";
import type { ProviderCredentials } from "./credentials.js";

export interface OAuthLoginOptions {
	clientId?: string;
	clientSecret?: string;
	scopes?: string[];
	redirectHost?: string;
	redirectPort?: number;
	openBrowser?: boolean;
	timeoutMs?: number;
	onMessage?: (message: string) => void;
}

interface OAuthSession {
	authorizationUrl: string;
	redirectUri: string;
	waitForCallback: Promise<{ code: string; state: string }>;
	close: () => void;
	codeVerifier: string;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export async function loginWithLocalCallback(
	providerName: ProviderName,
	options: OAuthLoginOptions = {},
): Promise<ProviderCredentials> {
	const provider = getProviderSpec(providerName);
	if (!provider || !provider.oauth) {
		throw new Error(`OAuth is not configured for provider "${providerName}"`);
	}

	const session = await createOAuthSession(provider.oauth, options);

	const openBrowser = options.openBrowser !== false;
	if (openBrowser) {
		try {
			await launchBrowser(session.authorizationUrl);
		} catch {
			options.onMessage?.("Unable to auto-open browser.");
		}
	}

	options.onMessage?.(`Open this URL to continue:\n${session.authorizationUrl}`);

	let callback;
	try {
		callback = await session.waitForCallback;
	} finally {
		session.close();
	}

	const token = await exchangeCodeForToken(provider.name, provider.oauth, {
		code: callback.code,
		codeVerifier: session.codeVerifier,
		redirectUri: session.redirectUri,
		clientId: resolveClientId(provider.oauth, options),
		clientSecret: resolveClientSecret(provider.oauth, options),
	});

	return token;
}

async function createOAuthSession(
	oauth: ProviderOAuthConfig,
	options: OAuthLoginOptions,
): Promise<OAuthSession> {
	const redirectHost = options.redirectHost || "127.0.0.1";
	const redirectPort = options.redirectPort ?? 53682;
	const redirectPath = oauth.redirectPath || "/oauth/callback";
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const usePkce = oauth.usePkce !== false;

	const state = base64Url(randomBytes(16));
	const codeVerifier = usePkce ? base64Url(randomBytes(32)) : "";
	const codeChallenge = usePkce
		? base64Url(createHash("sha256").update(codeVerifier).digest())
		: "";

	const server = createServer();
	const waitForCallback = new Promise<{ code: string; state: string }>(
		(resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error("Login timed out. Please try again."));
				server.close();
			}, timeoutMs);

			server.on("request", (req, res) => {
				if (!req.url) {
					res.statusCode = 400;
					res.end("Missing request URL.");
					return;
				}

				const url = new URL(req.url, `http://${redirectHost}`);
				if (url.pathname !== redirectPath) {
					res.statusCode = 404;
					res.end("Not found.");
					return;
				}

				const error = url.searchParams.get("error");
				if (error) {
					clearTimeout(timer);
					const errorDescription =
						url.searchParams.get("error_description") || error;
					res.statusCode = 400;
					res.end(`Login failed: ${errorDescription}`);
					reject(new Error(`Login failed: ${errorDescription}`));
					return;
				}

				const code = url.searchParams.get("code");
				const callbackState = url.searchParams.get("state");

				if (!code || !callbackState) {
					clearTimeout(timer);
					res.statusCode = 400;
					res.end("Missing authorization response.");
					reject(new Error("Missing authorization response."));
					return;
				}

				if (callbackState !== state) {
					clearTimeout(timer);
					res.statusCode = 400;
					res.end("State mismatch.");
					reject(new Error("State mismatch."));
					return;
				}

				clearTimeout(timer);
				res.statusCode = 200;
				res.end("Login complete. You can close this window.");
				resolve({ code, state: callbackState });
			});
		},
	);

	try {
		await new Promise<void>((resolve, reject) => {
			server.listen(redirectPort, redirectHost, () => resolve());
			server.on("error", reject);
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : String(error);
		throw new Error(
			`Failed to start local callback server on ${redirectHost}:${redirectPort}. ${message}. Use --redirect-port to choose a different port.`,
		);
	}

	const address = server.address() as AddressInfo;
	const redirectUri = `http://${redirectHost}:${address.port}${redirectPath}`;

	const authorizationUrl = buildAuthorizationUrl(oauth, {
		clientId: resolveClientId(oauth, options),
		redirectUri,
		state,
		codeChallenge,
		scopes: resolveScopes(oauth, options),
		usePkce,
	});

	return {
		authorizationUrl,
		redirectUri,
		waitForCallback,
		close: () => server.close(),
		codeVerifier,
	};
}

function resolveClientId(
	oauth: ProviderOAuthConfig,
	options: OAuthLoginOptions,
): string {
	const value =
		options.clientId ||
		resolveEnv(oauth.clientIdEnv) ||
		oauth.defaultClientId;
	if (!value) {
		const envList = oauth.clientIdEnv.join(", ");
		throw new Error(
			`Missing OAuth client ID. Set ${envList} or pass --client-id.`,
		);
	}
	return value;
}

function resolveClientSecret(
	oauth: ProviderOAuthConfig,
	options: OAuthLoginOptions,
): string | undefined {
	const value =
		options.clientSecret ||
		resolveEnv(oauth.clientSecretEnv || []) ||
		oauth.defaultClientSecret;
	return value || undefined;
}

function resolveScopes(
	oauth: ProviderOAuthConfig,
	options: OAuthLoginOptions,
): string[] {
	if (options.scopes && options.scopes.length > 0) {
		return options.scopes;
	}
	return oauth.scopes || [];
}

function buildAuthorizationUrl(
	oauth: ProviderOAuthConfig,
	input: {
		clientId: string;
		redirectUri: string;
		state: string;
		codeChallenge: string;
		scopes: string[];
		usePkce: boolean;
	},
): string {
	const url = new URL(oauth.authorizationUrl);
	url.searchParams.set("client_id", input.clientId);
	url.searchParams.set("redirect_uri", input.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("state", input.state);
	if (input.usePkce) {
		url.searchParams.set("code_challenge", input.codeChallenge);
		url.searchParams.set("code_challenge_method", "S256");
	}

	if (input.scopes.length > 0) {
		url.searchParams.set(
			"scope",
			input.scopes.join(oauth.scopeSeparator || " "),
		);
	}

	if (oauth.authorizationParams) {
		for (const [key, value] of Object.entries(oauth.authorizationParams)) {
			url.searchParams.set(key, value);
		}
	}

	return url.toString();
}

async function exchangeCodeForToken(
	providerName: ProviderName,
	oauth: ProviderOAuthConfig,
	input: {
		code: string;
		codeVerifier: string;
		redirectUri: string;
		clientId: string;
		clientSecret?: string;
	},
): Promise<ProviderCredentials> {
	const body = new URLSearchParams({
		client_id: input.clientId,
		code: input.code,
		redirect_uri: input.redirectUri,
		grant_type: "authorization_code",
	});
	if (oauth.usePkce !== false) {
		body.set("code_verifier", input.codeVerifier);
	}

	if (input.clientSecret) {
		body.set("client_secret", input.clientSecret);
	}

	if (oauth.tokenParams) {
		for (const [key, value] of Object.entries(oauth.tokenParams)) {
			body.set(key, value);
		}
	}

	const response = await fetch(oauth.tokenUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
			...(oauth.tokenHeaders || {}),
		},
		body: body.toString(),
	});

	const contentType = response.headers.get("content-type") || "";
	const rawText = await response.text();

	let payload: Record<string, string> = {};
	if (oauth.tokenResponseType === "form") {
		payload = Object.fromEntries(new URLSearchParams(rawText));
	} else if (oauth.tokenResponseType === "json") {
		payload = JSON.parse(rawText) as Record<string, string>;
	} else if (contentType.includes("application/json")) {
		payload = JSON.parse(rawText) as Record<string, string>;
	} else {
		payload = Object.fromEntries(new URLSearchParams(rawText));
	}

	if (!response.ok || payload.error) {
		const description = payload.error_description || payload.error || rawText;
		throw new Error(`Token exchange failed: ${description}`);
	}

	const credentials = mapTokenResponse(providerName, payload);

	if (payload.expires_in) {
		const expiresIn = Number(payload.expires_in);
		if (!Number.isNaN(expiresIn)) {
			credentials.expiresAt = new Date(
				Date.now() + expiresIn * 1000,
			).toISOString();
		}
	}
	if (!credentials.expiresAt && payload.expires_at) {
		const expiresAt = Number(payload.expires_at);
		if (!Number.isNaN(expiresAt)) {
			credentials.expiresAt = new Date(expiresAt * 1000).toISOString();
		}
	}

	return credentials;
}

function mapTokenResponse(
	providerName: ProviderName,
	payload: Record<string, string>,
): ProviderCredentials {
	const mapper = TOKEN_MAPPERS[providerName];
	if (mapper) {
		return mapper(payload);
	}

	const accessToken = payload.access_token;
	if (!accessToken) {
		throw new Error("Token exchange failed: missing access token.");
	}

	return {
		accessToken,
		refreshToken: payload.refresh_token,
		tokenType: payload.token_type || "bearer",
	};
}

const TOKEN_MAPPERS: Partial<
	Record<ProviderName, (payload: Record<string, string>) => ProviderCredentials>
> = {
	copilot: (payload) => {
		const accessToken = payload.access_token;
		if (!accessToken) {
			throw new Error("Token exchange failed: missing access token.");
		}

		return {
			refreshToken: accessToken,
			tokenType: payload.token_type || "bearer",
		};
	},
};

function resolveEnv(envVars: string[]): string | undefined {
	for (const key of envVars) {
		const value = process.env[key];
		if (value && value.trim()) {
			return value.trim();
		}
	}
	return undefined;
}

function base64Url(buffer: Buffer): string {
	return buffer
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

async function launchBrowser(url: string): Promise<void> {
	const platform = process.platform;

	if (platform === "darwin") {
		await spawnBrowser("open", [url]);
		return;
	}

	if (platform === "win32") {
		await spawnBrowser("cmd", ["/c", "start", "", url]);
		return;
	}

	await spawnBrowser("xdg-open", [url]);
}

function spawnBrowser(command: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: "ignore", detached: true });
		child.once("error", reject);
		child.once("spawn", () => resolve());
		child.unref();
	});
}
