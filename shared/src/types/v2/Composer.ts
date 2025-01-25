import { FileMetadata } from "./Message";

export type DiffViewCommand = {
	file: FileMetadata;
	isDarkTheme?: boolean;
};

export type IndexStats = {
	exists: boolean;
	processing: boolean;
	files: string[];
};

export type ManualStep = {
	description: string;
	command?: string;
};

export type Dependencies = {
	response?: string;
	steps?: ManualStep[];
}

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
	dependencies?: Dependencies;
	greeting?: string;
	error?: string;
}

export type ComposerResponse = {
	node: ComposerSteps;
	values: PlanExecuteState;
};

export type ComposerSteps = "assistant-question" | "composer-greeting" | "composer-replace" | "composer-files" | "composer-error" | "composer-done" | "composer-error";

export interface ComposerMessage {
	from: ComposerRole;
	message: string;
	loading?: boolean;
	image?: ComposerRequest["image"];
	files?: PlanExecuteState["files"];
	dependencies?: PlanExecuteState["dependencies"];
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
