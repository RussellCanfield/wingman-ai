import { FileMetadata } from "./Message";

export type DiffViewCommand = {
	file: string;
	diff: string;
	isDarkTheme?: boolean;
	original?: string;
	language?: string;
};

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

export interface PlanExecuteState {
	plan?: Plan;
	review?: Review;
	response?: string;
	retryCount?: number;
}

export type ComposerResponse = {
	node: ComposerSteps;
	values: PlanExecuteState;
};

export type ComposerSteps = "composer-planner" | "composer-manual-steps" | "composer-plan-file" | "composer-done" | "composer-error";

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
