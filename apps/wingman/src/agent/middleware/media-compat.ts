import { ChatAnthropic } from "@langchain/anthropic";
import {
	MIDDLEWARE_BRAND,
	type AgentMiddleware,
	type BaseMessage,
} from "langchain";

type MediaCompatibilityOptions = {
	model?: unknown;
	audioPlaceholder?: string;
};

const DEFAULT_AUDIO_PLACEHOLDER =
	"[Audio omitted: current model does not support audio inputs]";

export const mediaCompatibilityMiddleware = (
	options: MediaCompatibilityOptions = {},
): AgentMiddleware => {
	return {
		name: "media-compat-middleware",
		[MIDDLEWARE_BRAND]: true,
		beforeAgent: async (input: {
			messages: BaseMessage[];
		}): Promise<{ messages: BaseMessage[] }> => {
			if (!shouldStripAudio(options.model)) {
				return input;
			}

			let mutated = false;
			for (const message of input.messages) {
				const content = (message as { content?: unknown }).content;
				if (!Array.isArray(content)) {
					continue;
				}
				const { cleaned, removed } = stripAudioBlocks(content);
				if (!removed) {
					continue;
				}
				mutated = true;
				(message as { content?: unknown }).content =
					cleaned.length > 0
						? cleaned
						: options.audioPlaceholder || DEFAULT_AUDIO_PLACEHOLDER;
			}

			return mutated ? { messages: input.messages } : input;
		},
	};
};

function shouldStripAudio(model?: unknown): boolean {
	if (!model || typeof model !== "object") {
		return false;
	}
	if (model instanceof ChatAnthropic) {
		return true;
	}
	const ctorName = (model as { constructor?: { name?: string } })?.constructor
		?.name;
	return typeof ctorName === "string" && ctorName.toLowerCase() === "chatanthropic";
}

function stripAudioBlocks(
	blocks: Array<Record<string, unknown>>,
): { cleaned: Array<Record<string, unknown>>; removed: boolean } {
	let removed = false;
	const cleaned = blocks.filter((block) => {
		if (!block || typeof block !== "object") {
			return true;
		}
		const type = typeof block.type === "string" ? block.type.toLowerCase() : "";
		if (type === "audio" || type === "audio_url" || type === "input_audio") {
			removed = true;
			return false;
		}
		return true;
	});
	return { cleaned, removed };
}
