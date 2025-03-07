import type { CodeContextDetails } from "./Message";
import type { FileMetadata } from "./Message";

export type DiffViewCommand = {
	file: FileMetadata;
	threadId: string;
	isDarkTheme?: boolean;
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
	messages: ComposerMessage[];
	workspace: string;
	image?: ComposerImage;
	context?: CodeContextDetails;
	files: FileMetadata[];
}

export type ComposerResponse = {
	step: ComposerSteps;
	events: StreamEvent[];
	threadId: string;
	diagnostics?: FileDiagnostic[];
	tryAttempt?: number;
};

export type DiagnosticRange = {
	line: number;
	character: number;
};

export type DiagnosticResult = {
	start: DiagnosticRange;
	end: DiagnosticRange;
	message: string;
};

export type FileDiagnostic = {
	path: string;
	importErrors: DiagnosticResult[];
	lintErrors: DiagnosticResult[];
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
	| "composer-diagnostics"
	| "composer-error"
	| "composer-done";

export interface ComposerMessage {
	from: ComposerRole;
	message: string;
	loading: boolean;
	image?: ComposerRequest["image"];
	events?: StreamEvent[];
	threadId?: string;
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
