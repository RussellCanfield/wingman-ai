import type { CodeContextDetails } from "../Message";
import type { BaseMessage, FileMetadata } from "./Message";

export type DiffViewCommand = {
	file: FileMetadata;
	threadId: string;
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
};

export type ComposerRole = "assistant" | "user";

export interface ComposerChatMessage {
	kwargs: {
		content: string;
		role: ComposerRole;
	};
	name?: string;
}

export interface GraphState {
	messages: BaseMessage[];
	workspace: string;
	image?: ComposerImage;
	context?: CodeContextDetails;
	files: FileMetadata[];
	fileBackups: Record<string, string>;
}

export type AgentEvents = {
	events: StreamEvent[];
	threadId: string;
};

export type ComposerResponse = {
	node: ComposerSteps;
	values: AgentEvents;
};

export interface StreamEvent {
	id: string;
	type: "message" | "tool-start" | "tool-end";
	content: string;
	metadata?: {
		tool?: string;
		path?: string;
		action?: "read" | "write" | "modify";
	};
}

export type ComposerSteps =
	| "composer-events"
	| "composer-message-stream"
	| "composer-message-stream-finish"
	| "composer-message"
	| "composer-replace"
	| "composer-files"
	| "composer-error"
	| "composer-done"
	| "composer-error"
	| "composer-files-done";

export interface ComposerMessage {
	from: ComposerRole;
	message: string;
	loading?: boolean;
	image?: ComposerRequest["image"];
	events?: StreamEvent[];
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
	threadId: string;
	contextFiles: string[];
	recentFiles?: FileMetadata[];
	image?: ComposerImage;
	context?: CodeContextDetails;
};
