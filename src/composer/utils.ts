import { ChatMessage } from "@langchain/core/messages";
import fs from "node:fs";
import path from "node:path";

export const formatMessages = (messages: ChatMessage[]) => {
	return messages
		.map(msg => {
			const role = msg.role === 'user' ? 'User' : 'Assistant';
			return `${role}: ${msg.content}`;
		})
		.join('\n\n');
}

export const loadWingmanRules = (workspace: string) => {
	try {
		const wingmanRules = fs.readFileSync(
			path.join(workspace, ".wingmanrules"),
			"utf-8"
		);
		return wingmanRules;
	} catch (e) {
		console.error("Failed to load wingman rules", e);
	}
};
