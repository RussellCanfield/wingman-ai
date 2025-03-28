import type { FileDiagnostic } from "./Composer";
import type { CommandMetadata, FileMetadata } from "./Message";

export interface RenameThreadEvent {
	threadId: string;
	title: string;
}

export interface UpdateComposerFileEvent {
	files: FileMetadata[];
	threadId: string;
	toolId: string;
}

export interface FixDiagnosticsEvent {
	diagnostics: FileDiagnostic[];
	threadId: string;
}

export interface UpdateCommandEvent {
	command: CommandMetadata;
	threadId: string;
}

export interface ImageGenEvent {
	imageData: string | undefined;
	instructions: string;
}
