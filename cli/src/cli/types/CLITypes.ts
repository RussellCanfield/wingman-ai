import { WingmanAgent } from "@wingman-ai/agent";

export interface Message {
	id: string;
	type: 'human' | 'ai' | 'system' | 'tool';
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
}

export interface StreamingState {
	inputTokens: number;
	outputTokens: number;
	messages: Message[];
}