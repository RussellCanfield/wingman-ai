import type { ComposerMessage, FileDiagnostic } from "./Composer";
import type { CommandMetadata, FileMetadata } from "./Message";

export interface AddMessageToThreadEvent {
	threadId: string;
	message: ComposerMessage;
	canResume?: boolean;
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

export interface UpdateCommandEvent {
	command: CommandMetadata;
	threadId: string;
}
