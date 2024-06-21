import { AnthropicMessage, AnthropicResponseMessage } from "./ClaudeRequest";

export interface AnthropicResponse {
	content: AnthropicResponseMessage[];
}

export interface AnthropicStreamResponse {
	type: "content_block_start" | "content_block_end" | "content_block_delta";
}

export interface AnthropicResponseStreamContent {
	index: number;
	content_block: {
		type: "text";
		text: string;
	};
}

export interface AnthropicResponseStreamDelta {
	index: number;
	delta: {
		type: "text_delta";
		text: string;
	};
}
