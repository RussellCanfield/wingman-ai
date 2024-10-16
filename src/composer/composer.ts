import { END, START, StateGraph } from "@langchain/langgraph";
import type { BaseCheckpointSaver, StateGraphArgs } from "@langchain/langgraph";
import { ChatMessage } from "@langchain/core/messages";
import { CodeGraph } from "../server/files/graph";
import { RunnableConfig } from "@langchain/core/runnables";
import { CodeWriter } from "./tools/code-writer";
import { Replanner } from "./tools/replan";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Store } from "../store/vector.js";
import { Plan, PlanExecuteState, PlanningSteps, Review } from "./types/index";
import { getTextDocumentFromPath } from "../server/files/utils";
import { FileMetadata } from "@shared/types/Message";
import { CodePlanner } from "./tools/planner";
import { NoFilesChangedError } from "./errors";
import path from "path";

export interface Thread {
	configurable: {
		thread_id: string;
	};
}

export async function* generateCommand(
	workspace: string,
	description: string,
	model: BaseChatModel,
	rerankModel: BaseChatModel,
	codeGraph: CodeGraph,
	store: Store,
	config?: RunnableConfig,
	checkpointer?: BaseCheckpointSaver,
	contextFiles?: string[]
) {
	const planner = new CodePlanner(
		model,
		rerankModel,
		workspace,
		codeGraph,
		store
	);
	const codeWriter = new CodeWriter(model, workspace);
	const replanner = new Replanner(model, workspace);

	const planExecuteState: StateGraphArgs<PlanExecuteState>["channels"] = {
		messages: {
			//this is called randomly, not sure why yet, prevent duplicates
			value: (x: ChatMessage[], y: ChatMessage[]) => {
				const uniqueMessages = new Map<string, ChatMessage>();

				x?.forEach((msg) => {
					return uniqueMessages.set(msg.content.toString(), msg);
				});
				y?.forEach((msg) => {
					return uniqueMessages.set(msg.content.toString(), msg);
				});

				return Array.from(uniqueMessages.values());
			},
			default: () => [],
		},
		followUpInstructions: {
			//this is called randomly, not sure why yet, prevent duplicates
			value: (x: ChatMessage[], y: ChatMessage[]) => {
				const uniqueMessages = new Map<string, ChatMessage>();

				x?.forEach((msg) => {
					return uniqueMessages.set(msg.content.toString(), msg);
				});
				y?.forEach((msg) => {
					return uniqueMessages.set(msg.content.toString(), msg);
				});

				return Array.from(uniqueMessages.values());
			},
			default: () => [],
		},
		steps: {
			value: (x?: PlanningSteps[], y?: PlanningSteps[]) =>
				y ?? x ?? undefined,
		},
		plan: {
			value: (x?: Plan, y?: Plan) => y ?? x ?? undefined,
		},
		review: {
			value: (x?: Review, y?: Review) => {
				if (x && y) {
					return {
						comments: [
							...(x.comments || []),
							...(y.comments || []),
						],
					};
				}
				return y ?? x ?? undefined;
			},
			default: () => undefined,
		},
		projectDetails: {
			value: (x?: string, y?: string) => y ?? x,
		},
		response: {
			value: (x?: string, y?: string) => y ?? x,
			default: () => undefined,
		},
		retryCount: {
			value: (x?: number, y?: number) => y ?? x,
			default: () => 2,
		},
	};

	function shouldEnd(state: PlanExecuteState): "true" | "false" {
		return !state.review ||
			!state.review.comments ||
			state.review.comments.length === 0 ||
			(state.retryCount ?? 0) <= 0
			? "true"
			: "false";
	}

	let workflow = new StateGraph({
		channels: planExecuteState,
	})
		.addNode("planner", planner.codePlannerStep)
		.addNode("code-writer", codeWriter.codeWriterStep)
		.addNode("replan", replanner.replanStep)
		.addEdge(START, "planner")
		.addEdge("planner", "code-writer")
		.addEdge("code-writer", "replan")
		.addConditionalEdges("replan", shouldEnd, {
			true: END,
			false: "planner",
		});

	const checkpoint = await checkpointer?.get(config!);

	let inputs: Partial<PlanExecuteState> = {
		retryCount: undefined,
		review: undefined,
	};
	if (checkpoint?.channel_values["response"]) {
		inputs.followUpInstructions = [new ChatMessage(description, "user")];
	} else {
		inputs.messages = [new ChatMessage(description, "user")];
	}

	if (contextFiles?.length) {
		const uniqueFilePaths = new Set<string>();

		// Get existing files from the checkpoint
		const existingFiles =
			(
				checkpoint?.channel_values["plan"] as
					| PlanExecuteState["plan"]
					| undefined
			)?.files ?? [];

		// First, add all existing files from the checkpoint
		for (const existingFile of existingFiles) {
			uniqueFilePaths.add(path.relative(workspace, existingFile.file));
		}

		// Then, add new files from contextFiles if they're not already in the checkpoint
		for (const file of contextFiles) {
			const relativeFilePath = path.relative(workspace, file);
			if (!uniqueFilePaths.has(relativeFilePath)) {
				uniqueFilePaths.add(relativeFilePath);
				const txtDoc = await getTextDocumentFromPath(file);
				existingFiles.push({
					file,
					code: txtDoc?.getText() || "",
				});
			}
		}

		inputs.plan = {
			steps: [],
			files: existingFiles,
		};
	}

	const graph = workflow.compile({ checkpointer });

	try {
		for await (const chunk of await graph.stream(inputs, {
			streamMode: "updates",
			...config,
		})) {
			for (const [node, values] of Object.entries(chunk)) {
				yield { node, values };
			}
		}
	} catch (e) {
		if (e instanceof NoFilesChangedError) {
			yield {
				node: "replan",
				values: {
					response:
						"I was not able to generate any changes. Please try again with a different question or try explicitly referencing files.",
				},
			};
			return;
		}

		console.error(e);
		yield {
			node: "replan",
			values: {
				response:
					"An error occurred, please try again. If this continues use the clear chat button to start over.",
			},
		};
	}
}
