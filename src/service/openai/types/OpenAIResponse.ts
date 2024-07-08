import { OpenAIMessage } from "./OpenAIRequest";

export interface OpenAIResponse {
	choices: OpenAIResponseChoice[];
	usage: OpenAIResponseUsage;
}

export interface OpenAIStreamResponse {
	choices: OpenAIResponseStreamChoice[];
}

export interface OpenAIResponseChoice {
	index: number;
	message: OpenAIMessage;
	finish_reason: string;
}

export interface OpenAIResponseStreamChoice {
	index: number;
	delta: OpenAIMessage;
	finish_reason: string;
}

export interface OpenAIResponseUsage {
	prompt_tokens: number;
	completion_tokens: number;
	finish_reason: string;
}
