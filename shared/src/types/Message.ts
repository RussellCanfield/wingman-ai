export interface AppMessage {
	command: string;
	value: unknown;
}

export interface ChatMessage {
	from: "assistant" | "user";
	message: string;
	loading?: boolean;
	context?: CodeContext;
}

export interface FileMetadata {
	file: string;
	code?: string;
	analysis?: string;
	changes?: string[];
	review?: string;
}

export interface CodeContextDetails {
	lineRange: string;
	fileName: string;
	workspaceName: string;
	language: string;
	currentLine: string;
	text: string;
	fromSelection?: boolean;
}

export interface CodeContext
	extends Pick<
		CodeContextDetails,
		"fileName" | "lineRange" | "workspaceName"
	> {}
