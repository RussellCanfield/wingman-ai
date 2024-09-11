import { END, START, StateGraph } from "@langchain/langgraph";
import type { BaseCheckpointSaver, StateGraphArgs } from "@langchain/langgraph";
import { ChatMessage } from "@langchain/core/messages";
import { CodeGraph } from "../server/files/graph.js";
import { RunnableConfig } from "@langchain/core/runnables";
import { CodeWriter } from "./tools/code-writer.js";
import { Replanner } from "./tools/replan.js";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Store } from "../store/vector.js";
import { Plan, PlanExecuteState } from "./types/index.js";
import { getTextDocumentFromPath } from "../server/files/utils.js";
import { FileMetadata } from "@shared/types/Message.js";
import { CodePlanner } from "./tools/planner.js";

export interface Thread {
	configurable: {
		thread_id: string;
	};
}

export async function* generateCommand(
	workspace: string,
	description: string,
	model: BaseChatModel,
	codeGraph: CodeGraph,
	store: Store,
	config?: RunnableConfig,
	checkpointer?: BaseCheckpointSaver,
	contextFiles?: string[]
) {
	const planner = new CodePlanner(model, workspace, codeGraph, store);
	const codeWriter = new CodeWriter(model, workspace, codeGraph, store);
	const replanner = new Replanner(model, workspace);

	function mergeMaps<K, V>(map1?: Map<K, V>, map2?: Map<K, V>): Map<K, V> {
		const mergedMap = new Map<K, V>();

		if (!map1) {
			return map2 || new Map();
		}

		if (!map2) {
			return map1;
		}

		// Add entries from the first map
		for (const [key, value] of map1) {
			mergedMap.set(key, value);
		}

		// Add entries from the second map, overwriting duplicates
		for (const [key, value] of map2) {
			mergedMap.set(key, value);
		}

		return mergedMap;
	}

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
		plannerQuestions: {
			value: (x?: string[], y?: string[]) => y ?? x,
		},
		plan: {
			value: (x?: Plan, y?: Plan) => y ?? x ?? undefined,
		},
		response: {
			value: (x?: string, y?: string) => y ?? x,
			default: () => undefined,
		},
	};

	function shouldEnd(state: PlanExecuteState) {
		return state.response ? "true" : "false";
	}

	let workflow = new StateGraph({
		channels: planExecuteState,
	});

	const checkpoint = await checkpointer?.get(config!);

	let inputs: Partial<PlanExecuteState> = {};
	if (checkpoint?.channel_values["response"]) {
		inputs.followUpInstructions = [new ChatMessage(description, "user")];
	} else {
		inputs.messages = [new ChatMessage(description, "user")];
	}

	if (contextFiles?.length) {
		//@ts-expect-error
		workflow = workflow
			.addNode("code-writer", codeWriter.codeWriterStep)
			.addNode("replan", replanner.replanStep)
			.addEdge(START, "code-writer")
			.addEdge("code-writer", "replan")
			.addConditionalEdges("replan", shouldEnd, {
				true: END,
				false: "code-writer",
			});

		const files: FileMetadata[] = [];

		for (const file of contextFiles) {
			const txtDoc = await getTextDocumentFromPath(file);
			files.push({
				file,
				code: txtDoc?.getText() || "",
			});
		}

		inputs.plan = {
			steps: [],
			files,
		};
	} else {
		//@ts-expect-error
		workflow = workflow
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
