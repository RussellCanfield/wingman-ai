import type {
	AcceptFileEvent,
	RejectFileEvent,
	UndoFileEvent,
} from "@shared/types/Events";
import type { DiffViewCommand } from "@shared/types/v2/Composer";
import type { FileMetadata } from "@shared/types/v2/Message";
import { vscode } from "../../utilities/vscode";

export const acceptFile = (file: FileMetadata, threadId: string) => {
	if (file) {
		console.log(file);
		vscode.postMessage({
			command: "accept-file",
			value: {
				file,
				threadId,
			} satisfies AcceptFileEvent,
		});
	}
};

export const rejectFile = (file: FileMetadata, threadId: string) => {
	if (file) {
		vscode.postMessage({
			command: "reject-file",
			value: {
				file,
				threadId,
			} satisfies RejectFileEvent,
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

export const undoFile = (file: FileMetadata, threadId: string) => {
	if (file) {
		vscode.postMessage({
			command: "undo-file",
			value: {
				file,
				threadId,
			} satisfies UndoFileEvent,
		});
	}
};

export const openFile = (file: FileMetadata) => {
	if (file) {
		vscode.postMessage({
			command: "open-file",
			value: {
				path: file.path,
				id: file.id,
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
