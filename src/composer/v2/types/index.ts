import { ChatMessage } from "@langchain/core/messages";
import { ComposerRequest, Dependencies } from "@shared/types/v2/Composer";
import { FileTarget, UserIntent } from "./tools";
import { FileMetadata } from "@shared/types/v2/Message";
import { DirectoryContent } from "../../utils";

export type ManualStep = {
    description: string;
    command?: string;
};

export interface PlanExecuteState {
    messages: ChatMessage[];
    image?: ComposerRequest["image"];
    projectDetails?: string;
    userIntent?: UserIntent;
    currentTarget?: FileTarget;
    dependencies?: Dependencies;
    files?: FileMetadata[];
    error?: string;
    greeting?: string;
    scannedFiles?: DirectoryContent[];
}
