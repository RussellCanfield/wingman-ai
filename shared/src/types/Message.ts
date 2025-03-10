export interface AppMessage {
	command: string;
	value: unknown;
}

export interface FileMetadata {
	id?: string;
	description?: string;
	path: string;
	code?: string;
	original?: string;
	diff?: string;
	language?: string;
	accepted?: boolean;
	rejected?: boolean;
	lastModified?: number;
}

export interface CommandMetadata {
	id?: string;
	command: string;
	result?: string;
	accepted?: boolean;
	rejected?: boolean;
	success?: boolean;
	failed?: boolean;
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
