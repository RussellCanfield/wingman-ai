import { ChatMessage } from "@langchain/core/messages";
import { PlanExecuteState } from "./types";

export const formatMessages = (messages: ChatMessage[]) =>
	messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

export const buildObjective = (state: PlanExecuteState) => {
	let objective = `Objective:

${formatMessages(state.messages)}`;

	if (state.followUpInstructions.length > 0) {
		objective = `This was your original objective:

${formatMessages(state.messages)}

Since you completed your objective, the user given the following instructions to refine the code you've already written or modified:
  
${formatMessages(state.followUpInstructions)}`;
	}

	return objective;
};
