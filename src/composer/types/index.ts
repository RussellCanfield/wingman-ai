import { ChatMessage } from "@langchain/core/messages";
import { FileMetadata } from "@shared/types/Message";

export type PlanStep = {
	description: string;
	command?: string;
};

export type Plan = {
	steps: PlanStep[];
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
	projectDetails?: string;
	followUpInstructions: ChatMessage[];
	steps?: PlanningSteps[];
	plan?: Plan;
	review?: Review;
	response?: string;
	retryCount?: number;
}
