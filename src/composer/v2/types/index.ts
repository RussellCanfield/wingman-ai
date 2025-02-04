import { ChatMessage } from "@langchain/core/messages";
import { ComposerRequest } from "@shared/types/v2/Composer";
import { FileMetadata } from "@shared/types/v2/Message";
import { DirectoryContent } from "../../utils";

export interface PlanExecuteState {
    messages: ChatMessage[];
    image?: ComposerRequest["image"];
    projectDetails?: string;
    implementationPlan?: string;
    dependencies?: string[];
    files?: FileMetadata[];
    error?: string;
    scannedFiles?: DirectoryContent[];
    feature?: string;
}
