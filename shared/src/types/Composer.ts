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
}

export type FileSearchResult = {
	file: string;
	path: string;
};

export type ComposerRequest = {
	input: string;
	contextFiles: string[];
};
