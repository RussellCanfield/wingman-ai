import type { WingmanAgent } from "@wingman-ai/agent";
import type { TaskManager } from "../tasks/TaskManager.js";

export interface Message {
	id: string;
	type: "human" | "ai" | "system" | "tool";
	content: string;
	toolCalls?: any[];
	timestamp?: Date;
}

export interface CLIState {
	agent: WingmanAgent | null;
	threadId: string;
	messages: Message[];
	contextFiles: string[];
	contextDirectories: string[];
	inputTokens: number;
	outputTokens: number;
	model: string;
	taskManager?: TaskManager;
}