import {
	getProviderCredentials,
	resolveProviderToken,
	setProviderCredentials,
} from "./credentials.js";
import { getProviderSpec } from "./registry.js";

const COPILOT_HEADERS: Record<string, string> = {
	"User-Agent": "GitHubCopilotChat/0.35.0",
	"Editor-Version": "vscode/1.107.0",
	"Editor-Plugin-Version": "copilot-chat/0.35.0",
	"Copilot-Integration-Id": "vscode-chat",
};

const RESPONSES_API_ALTERNATE_INPUT_TYPES = new Set([
	"file_search_call",
	"computer_call",
	"computer_call_output",
	"web_search_call",
	"function_call",
	"function_call_output",
	"image_generation_call",
	"code_interpreter_call",
	"local_shell_call",
	"local_shell_call_output",
	"mcp_list_tools",
	"mcp_approval_request",
	"mcp_approval_response",
	"mcp_call",
	"reasoning",
]);

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

type FetchLike = (
	input: Parameters<typeof fetch>[0],
	init?: Parameters<typeof fetch>[1],
) => ReturnType<typeof fetch>;

export function createCopilotFetch(): FetchLike {
	const baseFetch = globalThis.fetch.bind(globalThis);

	return async (input, init) => {
		const accessToken = await resolveCopilotAccessToken(baseFetch);
		const { isAgentCall, isVisionRequest } = inspectRequest(init?.body);

		const headers = new Headers(init?.headers || {});
		headers.delete("authorization");
		headers.delete("x-api-key");

		for (const [key, value] of Object.entries(COPILOT_HEADERS)) {
			headers.set(key, value);
		}

		headers.set("Authorization", `Bearer ${accessToken}`);
		headers.set("Openai-Intent", "conversation-edits");
		headers.set("X-Initiator", isAgentCall ? "agent" : "user");
		if (isVisionRequest) {
			headers.set("Copilot-Vision-Request", "true");
		}

		return baseFetch(input, { ...init, headers });
	};
}

async function resolveCopilotAccessToken(
	baseFetch: typeof fetch,
): Promise<string> {
	const provider = getProviderSpec("copilot");
	const credentials = getProviderCredentials("copilot");
	const envToken = resolveProviderToken("copilot").token;

	const refreshToken =
		credentials?.refreshToken ||
		credentials?.accessToken ||
		credentials?.apiKey ||
		envToken;

	if (!refreshToken) {
		throw new Error(
			"Copilot credentials missing. Run `wingman provider login copilot`.",
		);
	}

	const expiresAt = credentials?.expiresAt
		? Date.parse(credentials.expiresAt)
		: undefined;
	const hasValidAccessToken =
		Boolean(credentials?.accessToken) &&
		(!expiresAt || expiresAt > Date.now() + REFRESH_BUFFER_MS);

	if (hasValidAccessToken && credentials?.accessToken) {
		return credentials.accessToken;
	}

	const tokenUrl = buildCopilotTokenUrl(provider?.baseURL);
	const response = await baseFetch(tokenUrl, {
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${refreshToken}`,
			...COPILOT_HEADERS,
		},
	});

	if (!response.ok) {
		throw new Error(`Copilot token refresh failed: ${response.status}`);
	}

	const tokenData = (await response.json()) as {
		token?: string;
		expires_at?: number;
		expires_in?: number;
	};

	if (!tokenData.token) {
		throw new Error("Copilot token refresh failed: missing token.");
	}

	const expiresAtIso = computeExpiry(tokenData);
	setProviderCredentials("copilot", {
		accessToken: tokenData.token,
		expiresAt: expiresAtIso,
	});

	return tokenData.token;
}

function buildCopilotTokenUrl(baseURL?: string): string {
	const fallback = "https://api.githubcopilot.com";
	const root = baseURL || fallback;
	return new URL("/copilot_internal/v2/token", root).toString();
}

function computeExpiry(tokenData: {
	expires_at?: number;
	expires_in?: number;
}): string | undefined {
	if (tokenData.expires_at) {
		return new Date(tokenData.expires_at * 1000 - REFRESH_BUFFER_MS).toISOString();
	}
	if (tokenData.expires_in) {
		return new Date(Date.now() + tokenData.expires_in * 1000 - REFRESH_BUFFER_MS).toISOString();
	}
	return undefined;
}

function inspectRequest(body: RequestInit["body"] | undefined): {
	isAgentCall: boolean;
	isVisionRequest: boolean;
} {
	let isAgentCall = false;
	let isVisionRequest = false;

	if (!body || typeof body !== "string") {
		return { isAgentCall, isVisionRequest };
	}

	try {
		const parsed = JSON.parse(body);
		if (parsed?.messages) {
			if (parsed.messages.length > 0) {
				const lastMessage = parsed.messages[parsed.messages.length - 1];
				isAgentCall =
					lastMessage?.role &&
					["tool", "assistant"].includes(lastMessage.role);
			}

			isVisionRequest = parsed.messages.some(
				(message: any) =>
					Array.isArray(message?.content) &&
					message.content.some(
						(part: any) => part?.type === "image_url",
					),
			);
		}

		if (parsed?.input) {
			const lastInput = parsed.input[parsed.input.length - 1];
			const isAssistant = lastInput?.role === "assistant";
			const hasAgentType = lastInput?.type
				? RESPONSES_API_ALTERNATE_INPUT_TYPES.has(lastInput.type)
				: false;
			isAgentCall = isAssistant || hasAgentType;

			isVisionRequest =
				Array.isArray(lastInput?.content) &&
				lastInput.content.some((part: any) => part?.type === "input_image");
		}
	} catch {
		return { isAgentCall, isVisionRequest };
	}

	return { isAgentCall, isVisionRequest };
}
