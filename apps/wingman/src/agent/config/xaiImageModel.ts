import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
	BaseChatModel,
	type BaseChatModelCallOptions,
	type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { AIMessage, AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";

export const DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1";

type XAIImageResponseFormat = "url" | "b64_json";

type XAIImageModelInput = BaseChatModelParams & {
	model: string;
	apiKey?: string;
	baseURL?: string;
	size?: string;
	responseFormat?: XAIImageResponseFormat;
};

type XAIImageGenerationResponse = {
	data?: Array<{
		url?: string;
		b64_json?: string;
		mime_type?: string;
		revised_prompt?: string;
	}>;
};

const IMAGE_MODEL_NAME_PATTERN = /^grok-imagine-image(?:[-:._].*)?$/i;
const XAI_IMAGE_PROMPT_MAX_CHARS = 7900;

export function isNativeXAIImageModel(modelName: string): boolean {
	return IMAGE_MODEL_NAME_PATTERN.test(modelName.trim());
}

function normalizeContentText(content: unknown): string {
	if (typeof content === "string") return content.trim();
	if (!Array.isArray(content)) return "";
	const parts = content
		.map((part) => {
			if (!part || typeof part !== "object" || Array.isArray(part)) return "";
			const record = part as Record<string, unknown>;
			return record.type === "text" && typeof record.text === "string"
				? record.text.trim()
				: "";
		})
		.filter(Boolean);
	return parts.join("\n").trim();
}

function normalizeRole(message: BaseMessage): string {
	const type =
		typeof (message as { type?: unknown }).type === "string"
			? ((message as { type?: string }).type as string)
			: typeof (message as { _getType?: unknown })._getType === "function"
				? String(
						(message as { _getType: () => unknown })._getType() ?? "",
					).toLowerCase()
				: "";
	return type.toLowerCase();
}

function resolveAdditionalKwargs(
	message: BaseMessage,
): Record<string, unknown> | undefined {
	const direct = (message as { additional_kwargs?: unknown }).additional_kwargs;
	if (direct && typeof direct === "object" && !Array.isArray(direct)) {
		return direct as Record<string, unknown>;
	}
	const kwargs = (message as { kwargs?: unknown }).kwargs;
	if (kwargs && typeof kwargs === "object" && !Array.isArray(kwargs)) {
		const nested = (kwargs as Record<string, unknown>).additional_kwargs;
		if (nested && typeof nested === "object" && !Array.isArray(nested)) {
			return nested as Record<string, unknown>;
		}
	}
	return undefined;
}

function isHiddenMiddlewarePrompt(message: BaseMessage, text: string): boolean {
	const additionalKwargs = resolveAdditionalKwargs(message);
	const uiHidden =
		additionalKwargs?.ui_hidden === true || additionalKwargs?.uiHidden === true;
	if (uiHidden) return true;

	const source =
		typeof additionalKwargs?.source === "string"
			? additionalKwargs.source.toLowerCase()
			: "";
	if (source === "additional-message-middleware") {
		return true;
	}

	const normalized = text.toLowerCase();
	return (
		normalized.includes("# confidentiality (internal)") &&
		normalized.includes("current date time (utc)")
	);
}

function clampPromptLength(prompt: string): string {
	if (prompt.length <= XAI_IMAGE_PROMPT_MAX_CHARS) {
		return prompt;
	}
	return prompt.slice(0, XAI_IMAGE_PROMPT_MAX_CHARS);
}

function buildPrompt(messages: BaseMessage[]): string {
	const systemParts: string[] = [];
	const visibleUserParts: string[] = [];
	const fallbackUserParts: string[] = [];

	for (const message of messages) {
		const text = normalizeContentText(message.content);
		if (!text) continue;
		const role = normalizeRole(message);
		if (role === "system") {
			systemParts.push(text);
			continue;
		}
		if (role === "human" || role === "user") {
			fallbackUserParts.push(text);
			if (!isHiddenMiddlewarePrompt(message, text)) {
				visibleUserParts.push(text);
			}
		}
	}

	const latestUserPrompt =
		visibleUserParts[visibleUserParts.length - 1] ||
		fallbackUserParts[fallbackUserParts.length - 1];
	if (!latestUserPrompt) {
		throw new Error("xAI image generation requires a user prompt.");
	}

	const systemPrefix = systemParts.join("\n\n").trim();
	if (!systemPrefix) {
		return clampPromptLength(latestUserPrompt);
	}

	const userSection = `User request:\n${latestUserPrompt}`;
	const withSystem = `System instructions:\n${systemPrefix}\n\n${userSection}`;
	if (withSystem.length <= XAI_IMAGE_PROMPT_MAX_CHARS) {
		return withSystem;
	}

	const systemPrefixLabel = "System instructions:\n";
	const userSectionPrefix = `\n\n${userSection}`;
	const availableSystemChars =
		XAI_IMAGE_PROMPT_MAX_CHARS -
		systemPrefixLabel.length -
		userSectionPrefix.length;
	if (availableSystemChars <= 0) {
		return clampPromptLength(userSection);
	}

	const truncatedSystem = systemPrefix.slice(0, availableSystemChars);
	return `${systemPrefixLabel}${truncatedSystem}${userSectionPrefix}`;
}

async function readErrorResponse(response: Response): Promise<string> {
	const body = await response.text();
	if (!body.trim()) {
		return `xAI image generation request failed with status ${response.status}.`;
	}
	try {
		const parsed = JSON.parse(body) as Record<string, unknown>;
		const errorRecord =
			parsed.error && typeof parsed.error === "object"
				? (parsed.error as Record<string, unknown>)
				: undefined;
		const message =
			(typeof errorRecord?.message === "string" && errorRecord.message) ||
			(typeof parsed.message === "string" && parsed.message) ||
			(typeof parsed.error === "string" && parsed.error);
		if (message) {
			return `xAI image generation failed: ${message}`;
		}
	} catch {
		// Ignore JSON parse errors and fall back to raw body.
	}
	return `xAI image generation failed: ${body}`;
}

export class NativeXAIImageModel extends BaseChatModel<BaseChatModelCallOptions> {
	model: string;

	apiKey?: string;

	baseURL: string;

	size?: string;

	responseFormat: XAIImageResponseFormat;

	constructor(fields: XAIImageModelInput) {
		super(fields);
		this.model = fields.model;
		this.apiKey = fields.apiKey;
		this.baseURL = (fields.baseURL || DEFAULT_XAI_BASE_URL).replace(/\/+$/, "");
		this.size = fields.size;
		this.responseFormat = fields.responseFormat || "url";
	}

	// LangGraph's createReactAgent always attempts to bind tools. Image-only models
	// don't support tool calling, so this is an intentional no-op.
	bindTools(
		_tools: unknown[],
		_options?: Record<string, unknown>,
	): NativeXAIImageModel {
		return this;
	}

	_llmType(): string {
		return "xai-image-native";
	}

	getLsParams(): {
		ls_provider: string;
		ls_model_name: string;
		ls_model_type: "chat";
	} {
		return {
			ls_provider: "xai",
			ls_model_name: this.model,
			ls_model_type: "chat",
		};
	}

	invocationParams(): Record<string, unknown> {
		return {
			provider: "xai",
			model: this.model,
			baseURL: this.baseURL,
			responseFormat: this.responseFormat,
			size: this.size,
		};
	}

	async _generate(
		messages: BaseMessage[],
		options: this["ParsedCallOptions"],
		_runManager?: CallbackManagerForLLMRun,
	): Promise<ChatResult> {
		if (!this.apiKey) {
			throw new Error(
				"Missing xAI credentials. Configure XAI_API_KEY before using grok-imagine-image.",
			);
		}

		const prompt = buildPrompt(messages);
		const payload: Record<string, unknown> = {
			model: this.model,
			prompt,
			response_format: this.responseFormat,
		};
		if (this.size) {
			payload.size = this.size;
		}

		const response = await this.caller.callWithOptions(
			{ signal: options.signal },
			async () =>
				fetch(`${this.baseURL}/images/generations`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
					signal: options.signal,
				}),
		);

		if (!response.ok) {
			throw new Error(await readErrorResponse(response));
		}

		const data = (await response.json()) as XAIImageGenerationResponse;
		const first = Array.isArray(data.data) ? data.data[0] : undefined;
		if (!first) {
			throw new Error("xAI image generation returned no image data.");
		}

		const imageUrl =
			typeof first.url === "string" && first.url.trim()
				? first.url.trim()
				: typeof first.b64_json === "string" && first.b64_json.trim()
					? `data:${first.mime_type || "image/png"};base64,${first.b64_json.trim()}`
					: "";
		if (!imageUrl) {
			throw new Error(
				"xAI image generation response was missing both url and b64_json.",
			);
		}

		const confirmationText = "Image generated.";
		const message = new AIMessage({
			content: [
				{
					type: "text",
					text: confirmationText,
				},
				{
					type: "output_image",
					image_url: imageUrl,
				},
			],
			response_metadata: {
				model: this.model,
				revised_prompt: first.revised_prompt,
			},
		});

		return {
			generations: [
				{
					text: confirmationText,
					message,
				},
			],
			llmOutput: {
				model: this.model,
			},
		};
	}

	async *_streamResponseChunks(
		messages: BaseMessage[],
		options: this["ParsedCallOptions"],
		runManager?: CallbackManagerForLLMRun,
	): AsyncGenerator<ChatGenerationChunk> {
		const result = await this._generate(messages, options, runManager);
		const generation = result.generations[0];
		if (!generation) return;
		const aiMessage = generation.message;
		const chunk = new AIMessageChunk({
			content: aiMessage.content,
			additional_kwargs: aiMessage.additional_kwargs,
			response_metadata: aiMessage.response_metadata,
		});
		if (generation.text) {
			await runManager?.handleLLMNewToken(generation.text);
		}
		yield new ChatGenerationChunk({
			text: generation.text || "",
			message: chunk,
			generationInfo: generation.generationInfo,
		});
	}
}
