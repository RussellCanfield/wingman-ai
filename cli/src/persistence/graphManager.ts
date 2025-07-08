import type { WingmanAgent, WingmanGraphState } from "@wingman-ai/agent";

export const getGraphState = (
	wingmanAgent: WingmanAgent,
	threadId: string,
): Promise<WingmanGraphState | undefined> => {
	return wingmanAgent.getGraphState(threadId);
};
