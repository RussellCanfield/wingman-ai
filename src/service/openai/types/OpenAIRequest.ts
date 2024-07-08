export interface OpenAIRequest {
	model: string;
	messages: OpenAIMessage[];
	temperature: number;
	stream?: boolean;
	top_p?: number;
	max_tokens?: number;
}

export interface OpenAIMessage {
	role: "user" | "assistant";
	content: string;
}
