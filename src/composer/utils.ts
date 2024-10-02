import { ChatMessage } from "@langchain/core/messages";
import { PlanExecuteState } from "./types";
import fs from "node:fs";
import path from "node:path";

export const formatMessages = (messages: ChatMessage[]) =>
	messages.map((m) => m.content).join("\n");

export const buildObjective = (state: PlanExecuteState): string => {
	const messages = state.messages;
	const followUpInstructions = state.followUpInstructions;
	let objectiveItems: string[] = [];

	// Add the last message as completed if there are follow-up instructions
	if (followUpInstructions.length > 0 && messages.length > 0) {
		objectiveItems.push(
			`(Completed) - ${formatMessages([messages[messages.length - 1]])}`
		);
	} else if (messages.length > 0) {
		objectiveItems.push(formatMessages([messages[messages.length - 1]]));
	}

	// Add follow-up instructions, marking all but the last as completed
	followUpInstructions.forEach((instruction, index) => {
		const isLast = index === followUpInstructions.length - 1;
		objectiveItems.push(
			isLast
				? formatMessages([instruction])
				: `(Completed) - ${formatMessages([instruction])}`
		);
	});

	return `Objective:
Note - consider but do not act on "Completed" objective steps.

${objectiveItems.join("\n\n")}`;
};

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
