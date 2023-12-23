export interface AppMessage {
	command: string;
	value: string;
}

export interface ChatMessage {
	from: "Assistant" | "User";
	message: string;
}
