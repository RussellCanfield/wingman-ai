import type { ChatMessage } from "@langchain/core/messages";
import type { ComposerRequest } from "@shared/types/Composer";
import type { FileMetadata } from "@shared/types/Message";
import type { DirectoryContent } from "../utils";

export interface PlanExecuteState {
	messages: ChatMessage[];
	image?: ComposerRequest["image"];
	projectDetails?: string;
	implementationPlan?: string;
	dependencies?: string[];
	files?: FileMetadata[];
	error?: string;
	scannedFiles?: DirectoryContent[];
}
