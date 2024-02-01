export interface OpenAIRequest {
	model: string;
	messages: OpenAIMessages[];
	temperature: number;
	stream?: boolean;
	top_p?: number;
}

export interface OpenAIMessages {
	role: "user" | "assistant";
	content: string;
}
