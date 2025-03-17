import type { DiffViewCommand } from "@shared/types/Composer";
import type { FileMetadata } from "@shared/types/Message";
import { vscode } from "./vscode";
import type { UpdateComposerFileEvent } from "@shared/types/Events";

export const acceptFile = (event: UpdateComposerFileEvent) => {
	if (event) {
		vscode.postMessage({
			command: "accept-file",
			value: event,
		});
	}
};

export const rejectFile = (event: UpdateComposerFileEvent) => {
	if (event) {
		vscode.postMessage({
			command: "reject-file",
			value: event,
		});
	}
};

export const showDiffview = (event: DiffViewCommand) => {
	if (event) {
		vscode.postMessage({
			command: "diff-view",
			value: event,
		});
	}
};

export const undoFile = (event: UpdateComposerFileEvent) => {
	if (event) {
		vscode.postMessage({
			command: "undo-file",
			value: event,
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
	if (path.indexOf("/") === -1) return path;

	const parts = path.split("/");
	const fileName = parts.pop() ?? "";
	const lastFolder = parts.pop();

	const shortPath = lastFolder ? `${lastFolder}/${fileName}` : fileName;

	return parts.length > 0 ? `.../${shortPath}` : shortPath;
};
