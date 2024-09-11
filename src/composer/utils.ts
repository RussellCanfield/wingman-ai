import { ChatMessage } from "@langchain/core/messages";

export const formatMessages = (messages: ChatMessage[]) =>
	messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
