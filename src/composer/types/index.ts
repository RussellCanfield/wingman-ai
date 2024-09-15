import { ChatMessage } from "@langchain/core/messages";
import { FileMetadata } from "@shared/types/Message";

export type PlanStep = {
	description: string;
	command?: string;
};

export interface Plan {
	steps: PlanStep[];
	files?: FileMetadata[];
}

export interface Review {
	comments: string[];
}

export interface PlanExecuteState {
	messages: ChatMessage[];
	followUpInstructions: ChatMessage[];
	plannerQuestions?: string[];
	plan?: Plan;
	review?: Review;
	response?: string;
}
