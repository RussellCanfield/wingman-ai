import type { CodeContextDetails, CommandMetadata } from "./Message";
import type { FileMetadata } from "./Message";

export type DiffViewCommand = {
	file: FileMetadata;
	threadId: string;
	isDarkTheme?: boolean;
	toolId: string;
	showRevert?: boolean;
};

export interface ComposerState {
	title: string;
	createdAt: number;
	parentThreadId?: string;
	messages: ComposerMessage[];
	canResume?: boolean;
	threadId: string;
}

export interface ComposerThread {
	id: string;
	title: string;
	createdAt: number;
	parentThreadId?: string;
	fromMessage?: boolean;
}

export interface ComposerThreadEvent {
	state: ComposerState;
	activeThreadId: string;
}

export type ComposerResponse = {
	event: ComposerEvent;
	state: ComposerState;
	diagnostics?: FileDiagnostic[];
};

export type ComposerStreamingResponse = {
	event: ComposerEvent;
	state: Pick<ComposerState, "messages" | "threadId">;
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

export type ComposerEvent =
	| "composer-message"
	| "composer-events"
	| "composer-diagnostics"
	| "composer-error"
	| "composer-done"
	| "no-op";

export class BaseMessage {
	id: string;
	role: "tool" | "assistant" | "user";
	inputTokens?: number;
	outputTokens?: number;
}

export class ToolMessage extends BaseMessage {
	name: string;
	toolCallId: string;
	content: string | Record<string, unknown>;
	type: "start" | "end";
	metadata?: Record<string, unknown>;

	constructor(
		id: string,
		name: string,
		toolCallId: string,
		content: Record<string, unknown>,
		type: "start" | "end",
		metadata?: Record<string, unknown>,
	) {
		super();

		this.id = id;
		this.name = name;
		this.role = "tool";
		this.toolCallId = toolCallId;
		this.content = content;
		this.metadata = metadata;
		this.type = type;
		this.role = "tool";
	}
}

export class AssistantMessage extends BaseMessage {
	content: string;

	constructor(
		id: string,
		input: string,
		inputTokens?: number,
		outputTokens?: number,
	) {
		super();

		this.id = id;
		this.content = input;
		this.role = "assistant";
		this.inputTokens = inputTokens;
		this.outputTokens = outputTokens;
	}
}

export class UserMessage extends BaseMessage {
	content: string;
	image?: ComposerImage;

	constructor(id: string, input: string, image?: ComposerImage) {
		super();

		this.id = id;
		this.content = input;
		this.role = "user";
		this.image = image;
	}
}

export type ComposerMessage = UserMessage | AssistantMessage | ToolMessage;

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
