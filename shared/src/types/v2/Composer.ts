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
	files?: FileMetadata[];
	dependencies?: Dependencies;
	error?: string;
}

export type ComposerResponse = {
	node: ComposerSteps;
	values: PlanExecuteState;
};

export type ComposerSteps = "composer-message-stream" | "composer-message-stream-finish" | "composer-message" | "composer-replace" | "composer-files" | "composer-error" | "composer-done" | "composer-error" | "composer-files-done";

export interface ComposerMessage {
	from: ComposerRole;
	message: string;
	loading?: boolean;
	image?: ComposerRequest["image"];
	files?: PlanExecuteState["files"];
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
