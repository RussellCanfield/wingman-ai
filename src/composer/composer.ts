import { END, START, StateGraph } from "@langchain/langgraph";
import type { BaseCheckpointSaver, StateGraphArgs } from "@langchain/langgraph";
import { ChatMessage } from "@langchain/core/messages";
import { CodeGraph } from "../server/files/graph";
import { RunnableConfig } from "@langchain/core/runnables";
import { CodeWriter } from "./tools/code-writer";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Store } from "../store/vector.js";
import { Plan, PlanExecuteState, Review } from "./types/index";
import { getTextDocumentFromPath } from "../server/files/utils";
import { CodePlanner } from "./tools/planner";
import { NoFilesChangedError, NoFilesFoundError } from "./errors";
import path from "path";
import { ComposerRequest } from "@shared/types/Composer";

export interface Thread {
	configurable: {
		thread_id: string;
	};
}

let controller = new AbortController();

export function cancelComposer() {
	controller.abort();
}

export async function* generateCommand(
	workspace: string,
	request: ComposerRequest,
	model: BaseChatModel,
	rerankModel: BaseChatModel,
	codeGraph: CodeGraph,
	store: Store,
	config?: RunnableConfig,
	checkpointer?: BaseCheckpointSaver
) {
	controller = new AbortController();

	const planner = new CodePlanner(
		model,
		rerankModel,
		workspace,
		codeGraph,
		store
	);
	const codeWriter = new CodeWriter(model, workspace);

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
		image: {
			value: (
				x?: ComposerRequest["image"],
				y?: ComposerRequest["image"]
			) => y ?? x,
		},
	};

	let workflow = new StateGraph({
		channels: planExecuteState,
	})
		.addNode("planner", planner.codePlannerStep)
		.addNode("code-writer", codeWriter.codeWriterStep)
		.addEdge(START, "planner")
		.addEdge("planner", "code-writer");

	const checkpoint = await checkpointer?.get(config!);

	let inputs: Partial<PlanExecuteState> = {
		retryCount: undefined,
		review: undefined,
	};
	if (checkpoint?.channel_values["response"]) {
		inputs.followUpInstructions = [new ChatMessage(request.input, "user")];
	} else {
		inputs.messages = [new ChatMessage(request.input, "user")];
	}

	if (request.contextFiles?.length) {
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
			uniqueFilePaths.add(path.relative(workspace, existingFile.path));
		}

		// Then, add new files from contextFiles if they're not already in the checkpoint
		for (const file of request.contextFiles) {
			const relativeFilePath = path.relative(workspace, file);
			if (!uniqueFilePaths.has(relativeFilePath)) {
				uniqueFilePaths.add(relativeFilePath);
				const txtDoc = await getTextDocumentFromPath(file);
				existingFiles.push({
					path: file,
					code: txtDoc?.getText() || "",
				});
			}
		}

		inputs.plan = {
			files: existingFiles,
		};
	}

	if (inputs.plan?.files) {
		[
			(inputs.plan.files = inputs.plan.files.map((f) => {
				return {
					path: f.path,
					code: f.code,
					relativePath: path.relative(workspace, f.path),
					changes: [],
				};
			})),
		];
	}

	if (request.image) {
		inputs.image = request.image;
	}

	inputs.retryCount = 2;

	const graph = workflow.compile({ checkpointer });

	try {
		for await (const chunk of await graph.streamEvents(inputs, { 
			streamMode: ["custom"],
			signal: controller.signal,
			version: "v2",
			...config
		})) {
			if (!chunk) continue;

			const { event, name, data } = chunk;
			if (event === "on_custom_event") {
			  yield { node: name, values: data };
			}
		}
	} catch (e) {
		if (e instanceof DOMException && e.name === "AbortError") {
			yield {
				node: "composer-error",
				values: {
					response: "Operation was cancelled",
				},
			};
			return;
		} else if (e instanceof NoFilesChangedError) {
			yield {
				node: "composer-error",
				values: {
					response:
						"I was not able to generate any changes. Please try again with a different question or try explicitly referencing files.",
				},
			};
			return;
		} else if (e instanceof NoFilesFoundError) {
			yield {
				node: "composer-error",
				values: {
					response:
						"I was unable to find any indexed code files. Please reference files directly using '@filename', build the full index or make sure embeddings are enabled in settings.",
				},
			};
			return;
		}

		console.error(e);
		yield {
			node: "composer-error",
			values: {
				response:
					"An error occurred, please try again. If this continues use the clear chat button to start over.",
			},
		};
	}
}
