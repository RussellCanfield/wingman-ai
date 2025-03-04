import type { ComposerMessage } from "./v2/Composer";
import type { FileMetadata } from "./v2/Message";

export interface AddMessageToThreadEvent {
	threadId: string;
	message: ComposerMessage;
}

export interface RenameThreadEvent {
	threadId: string;
	title: string;
}

export interface UpdateComposerFileEvent {
	files: FileMetadata[];
	threadId: string;
}
