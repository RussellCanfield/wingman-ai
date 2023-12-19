import { ModelStream } from "../../service/llm";

export interface AppMessage {
	command: string;
	value: ModelStream;
}

export interface ChatMessage {
	from: "bot" | "user";
	message: string;
}
