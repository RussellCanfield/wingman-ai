import type { ComposerMessage, FileDiagnostic } from "./Composer";
import type { FileMetadata } from "./Message";

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

export interface FixDiagnosticsEvent {
	diagnostics: FileDiagnostic[];
	threadId: string;
}
