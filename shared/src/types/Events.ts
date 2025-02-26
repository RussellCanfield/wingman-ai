import { ComposerMessage } from "./v2/Composer";
import { FileMetadata } from "./v2/Message";

export interface AddMessageToThreadEvent {
    threadId: string;
    message: ComposerMessage;
}

export interface RenameThreadEvent {
    threadId: string;
    title: string;
}

export interface AcceptFileEvent {
    file: FileMetadata,
    threadId: string
}

export interface RejectFileEvent {
    file: FileMetadata;
    threadId: string;
}

export interface UndoFileEvent {
    file: FileMetadata;
    threadId: string;
}