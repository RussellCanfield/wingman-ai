export interface AnthropicRequest {
	model: string;
	messages: AnthropicMessage[];
	temperature: number;
	stream?: boolean;
	system?: string;
	top_p?: number;
	top_k?: number;
	max_tokens: number;
}

export interface AnthropicResponseMessage {
	type: "text";
	text: string;
}

export interface AnthropicMessage {
	role: "user" | "assistant";
	content: string;
}
