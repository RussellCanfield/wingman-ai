import type { DiffViewCommand } from "@shared/types/v2/Composer";
import type { FileMetadata } from "@shared/types/v2/Message";
import { vscode } from "./vscode";
import type { UpdateComposerFileEvent } from "@shared/types/Events";

export const acceptFile = ({ files, threadId }: UpdateComposerFileEvent) => {
	if (files) {
		vscode.postMessage({
			command: "accept-file",
			value: {
				files,
				threadId,
			} satisfies UpdateComposerFileEvent,
		});
	}
};

export const rejectFile = ({ files, threadId }: UpdateComposerFileEvent) => {
	if (files) {
		vscode.postMessage({
			command: "reject-file",
			value: {
				files,
				threadId,
			} satisfies UpdateComposerFileEvent,
		});
	}
};

export const showDiffview = (file: FileMetadata, threadId: string) => {
	if (file) {
		vscode.postMessage({
			command: "diff-view",
			value: {
				file,
				threadId,
			} satisfies DiffViewCommand,
		});
	}
};

export const undoFile = ({ files, threadId }: UpdateComposerFileEvent) => {
	if (files) {
		vscode.postMessage({
			command: "undo-file",
			value: {
				files,
				threadId,
			} satisfies UpdateComposerFileEvent,
		});
	}
};

export const openFile = (file: FileMetadata) => {
	if (file) {
		vscode.postMessage({
			command: "open-file",
			value: {
				path: file.path,
			} satisfies FileMetadata,
		});
	}
};

export const getTruncatedPath = (path: string) => {
	const parts = path.split("/");
	const fileName = parts.pop() ?? "";
	const lastFolder = parts.pop();

	const shortPath = lastFolder ? `${lastFolder}/${fileName}` : fileName;

	return parts.length > 0 ? `.../${shortPath}` : shortPath;
};
