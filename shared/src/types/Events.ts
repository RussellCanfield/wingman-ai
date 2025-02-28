import type { ComposerMessage, GraphState } from "./v2/Composer";
import type { FileMetadata } from "./v2/Message";

export interface AddMessageToThreadEvent {
	threadId: string;
	message: ComposerMessage;
	state?: GraphState;
}

export interface RenameThreadEvent {
	threadId: string;
	title: string;
}

export interface UpdateComposerFileEvent {
	file: FileMetadata;
	threadId: string;
}
