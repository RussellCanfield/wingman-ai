import { FileMetadata } from "./Message";

export type DiffViewCommand = {
	file: string;
	diff: string;
	isDarkTheme?: boolean;
	original?: string;
	language?: string;
};

export type ManualStep = {
	description: string;
	command?: string;
};

export type ComposerRole = "assistant" | "user";

export interface ComposerChatMessage {
	kwargs: {
		content: string;
		role: ComposerRole;
	},
	name?: string;
}

export interface PlanExecuteState {
	messages?: ComposerChatMessage[];
	userIntent?: {
		task: string;
	},
	files?: FileMetadata[];
	steps?: ManualStep[];
	greeting?: string;
}

export type ComposerResponse = {
	node: ComposerSteps;
	values: PlanExecuteState;
};

export type ComposerSteps = "assistant-question" | "composer-greeting" | "composer-files" | "composer-error" | "composer-manual-steps" | "composer-done" | "composer-error";

export interface ComposerMessage {
	from: ComposerRole;
	message: string;
	loading?: boolean;
	image?: ComposerRequest["image"];
	files?: PlanExecuteState["files"];
	steps?: PlanExecuteState["steps"];
	greeting?: string;
}

export type FileSearchResult = {
	file: string;
	path: string;
};

export type ComposerImage = {
	data: string;
	ext: string;
};

export type ComposerRequest = {
	input: string;
	contextFiles: string[];
	image?: ComposerImage;
};
