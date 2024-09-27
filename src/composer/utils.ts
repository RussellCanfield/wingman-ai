import { ChatMessage } from "@langchain/core/messages";
import { PlanExecuteState } from "./types";
import fs from "node:fs";
import path from "node:path";

export const formatMessages = (messages: ChatMessage[]) =>
	messages.length > 0 ? messages[messages.length - 1].content : "";

export const buildObjective = (state: PlanExecuteState) => {
	let objective = `Objective:

${formatMessages(state.messages)}`;

	if (state.followUpInstructions.length > 0) {
		objective = `Objective:

${formatMessages(state.followUpInstructions)}`;
	}

	return objective;
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
