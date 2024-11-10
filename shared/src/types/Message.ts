export interface AppMessage {
	command: string;
	value: unknown;
}

export type FileModification = {
	appliedAt: number;
	offset: number;
};

export interface FileReviewDetails {
	file: string;
	diff?: string;
	original?: string;
	current?: string;
	comments?: CodeReviewComment[];
	modifications?: FileModification[];
}

export interface FileDetails {
	diff: string;
	file: string;
}

export type CodeCommentAction = undefined | "remove" | "replace";

export interface CodeReviewComment {
	startLine: number;
	endLine: number;
	action?: CodeCommentAction;
	body: string;
	code?: string;
	accepted?: boolean;
	rejected?: boolean;
}

export interface CodeReview {
	summary: string;
	fileDiffMap?: Record<string, FileReviewDetails>;
}

export interface CodeReviewCommand {
	review: CodeReview;
	isDarkTheme: boolean;
}

export type MessageType = "chat" | "code-review";

export type ChatMessages = Array<Message | CodeReviewMessage>;
export type ChatMessage = Message | CodeReviewMessage;

export interface CodeReviewMessage extends BaseMessage {
	review: CodeReview;
	type: "code-review";
}

export interface Message extends BaseMessage {
	context?: CodeContext;
	from: "assistant" | "user";
	message: string;
	type: "chat";
}

export interface BaseMessage {
	loading?: boolean;
	type?: MessageType;
}

export interface FileMetadata {
	path: string;
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
