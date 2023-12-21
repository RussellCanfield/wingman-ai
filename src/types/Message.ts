import { ModelStream } from "../service/llm";

export interface AppMessage {
	command: string;
	value: ModelStream;
}

export interface ChatMessage {
	from: "assistant" | "user";
	message: string;
}
