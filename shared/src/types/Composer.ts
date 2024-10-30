import { FileMetadata } from "./Message";

export type DiffViewCommand = {
	file: string;
	diff: string;
	theme?: Number;
	original?: string;
};

export type PlanStep = {
	description: string;
	command?: string;
};

export interface Plan {
	steps: PlanStep[];
	files: FileMetadata[];
}

export interface PlanExecuteState {
	plan?: Plan;
	response?: string;
	review: {
		comments: string[];
	};
	retryCount?: number;
}

export type ComposerResponse = {
	node: ComposerSteps;
	values: PlanExecuteState;
};

export type ComposerSteps =
	| "planner"
	| "retrieve-documents"
	| "code-analyzer"
	| "code-writer"
	| "code-reviewer"
	| "replan";

export interface ComposerMessage {
	from: "assistant" | "user";
	message: string;
	loading?: boolean;
	plan: Plan;
	image?: ComposerRequest["image"];
}

export type FileSearchResult = {
	file: string;
	path: string;
};

export type ComposerImage = {
	data: string;
	ext: string;
};

export type ComposerRequest = {
	input: string;
	contextFiles: string[];
	image?: ComposerImage;
};
