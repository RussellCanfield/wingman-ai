import { ChatMessage } from "@langchain/core/messages";
import { ComposerRequest } from "@shared/types/Composer";
import { FileMetadata } from "@shared/types/Message";

export type ManualStep = {
	description: string;
	command?: string;
};

export type Plan = {
	summary?: string;
	steps?: ManualStep[];
	files?: FileMetadata[];
};

export type Review = {
	comments?: string[];
};

export type PlanningSteps = {
	file: string;
	steps: string[];
};

export interface PlanExecuteState {
	messages: ChatMessage[];
	image?: ComposerRequest["image"];
	projectDetails?: string;
	followUpInstructions: ChatMessage[];
	steps?: PlanningSteps[];
	plan?: Plan;
	review?: Review;
	response?: string;
	retryCount?: number;
}
