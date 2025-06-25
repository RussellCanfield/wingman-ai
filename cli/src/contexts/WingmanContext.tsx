import {
	WingmanAgent,
	type WingmanGraphState,
	type WingmanRequest,
} from "@wingman-ai/agent";
import {
	AIMessage,
	AIMessageChunk,
	type ToolMessage,
	type BaseMessage,
} from "@langchain/core/messages";
import fs from "node:fs";
import {
	useEffect,
	useCallback,
	useRef,
	createContext,
	type ReactNode,
	useContext,
	useReducer,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { loadConfig, createModel } from "../config/";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { initialState, wingmanReducer } from "./wingmanReducer";
import type { Message } from "./types";
import { Status } from "./types";
import { getWingmanInstructions } from "src/config";
import { handleCommand } from "src/commands/commandHandler";

export interface WingmanContextType {
	messages: Message[];
	status: Status;
	input: string;
	inputTokens: number;
	outputTokens: number;
	model: string;
	contextFiles: string[];
	contextDirectories: string[];
	isContextViewExpanded: boolean;
	setInput: (input: string | ((prev: string) => string)) => void;
	handleSubmit: (request: WingmanRequest) => Promise<void>;
	toggleContextView: () => void;
	clearContext: () => void;
}

export const WingmanContext = createContext<WingmanContextType | undefined>(
	undefined,
);

export function WingmanProvider({
	children,
	initialPrompt,
}: {
	children: ReactNode;
	initialPrompt?: string;
}) {
	const [state, dispatch] = useReducer(wingmanReducer, initialState);
	const {
		messages,
		status,
		input,
		inputTokens,
		outputTokens,
		model,
		contextFiles,
		contextDirectories,
		isContextViewExpanded,
		summary,
	} = state;

	const agent = useRef<WingmanAgent | null>(null);
	const threadId = useRef<string>(uuidv4());

	const setInput = (input: string | ((prev: string) => string)) => {
		dispatch({ type: "SET_INPUT", payload: input });
	};

	const toggleContextView = useCallback(() => {
		dispatch({ type: "TOGGLE_CONTEXT_VIEW" });
	}, []);

	const clearContext = useCallback(() => {
		dispatch({ type: "CLEAR_CONTEXT" });
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	const handleSubmit = useCallback(
		async (request: WingmanRequest) => {
			const commandHandled = await handleCommand({
				request,
				agent,
				threadId,
				dispatch,
			});

			if (commandHandled) {
				return;
			}

			if (!agent.current) return;

			if (request.contextFiles) {
				dispatch({
					type: "ADD_CONTEXT_FILES",
					payload: request.contextFiles,
				});
			}
			if (request.contextDirectories) {
				dispatch({
					type: "ADD_CONTEXT_DIRECTORIES",
					payload: request.contextDirectories,
				});
			}

			const finalInput = summary
				? `Summary of previous conversation:\n${summary}\n\nContinue the conversation based on this summary.\n\n${request.input}`
				: request.input;

			const humanMessage: Message = {
				id: uuidv4(),
				type: "human",
				content: finalInput,
			};
			dispatch({ type: "ADD_MESSAGE", payload: humanMessage });
			dispatch({ type: "SET_STATUS", payload: Status.Thinking });
			dispatch({ type: "SET_INPUT", payload: "" });

			const fullRequest: WingmanRequest = {
				...request,
				input: finalInput,
				threadId: threadId.current,
			};

			let currentAiMessageId: string | null = null;

			try {
				for await (const res of agent.current.stream(fullRequest)) {
					const { messages: newMessages } = res as WingmanGraphState;
					const message = newMessages[newMessages.length - 1] as BaseMessage;

					if (message instanceof AIMessageChunk || message instanceof AIMessage) {
						if (message.tool_calls && message.tool_calls.length > 0) {
							const existingToolCallIds = new Set(
								messages.filter((m) => m.type === "tool").map((m) => m.id),
							);
							const toolCalls = message.tool_calls ?? [];
							const newToolCallMessages: Message[] = toolCalls
								.filter((tc) => tc.id && !existingToolCallIds.has(tc.id))
								.map((toolCall) => ({
									id: toolCall.id!,
									type: "tool",
									toolName: toolCall.name,
									args: toolCall.args,
									content: "",
									toolStatus: "executing",
								}));

							if (newToolCallMessages.length > 0) {
								dispatch({ type: "SET_STATUS", payload: Status.ExecutingTool });
								// biome-ignore lint/complexity/noForEach: <explanation>
								newToolCallMessages.forEach((msg) =>
									dispatch({ type: "ADD_MESSAGE", payload: msg }),
								);
							}
						}

						if (
							message.content &&
							typeof message.content === "string" &&
							message.content.trim()
						) {
							if (!currentAiMessageId) {
								const newAiMessage: Message = {
									id: uuidv4(),
									type: "ai",
									content: message.content,
									tokenCount: message.usage_metadata?.total_tokens,
								};
								currentAiMessageId = newAiMessage.id;
								if (message.usage_metadata) {
									dispatch({
										type: "ADD_TOKENS",
										payload: {
											input: message.usage_metadata.input_tokens,
											output: message.usage_metadata.output_tokens,
										},
									});
								}
								dispatch({ type: "ADD_MESSAGE", payload: newAiMessage });
							} else {
								dispatch({
									type: "UPDATE_LAST_MESSAGE",
									payload: {
										content: message.content as string,
										usage_metadata: message.usage_metadata,
									},
								});
								if (message.usage_metadata) {
									dispatch({
										type: "ADD_TOKENS",
										payload: {
											input: message.usage_metadata.input_tokens,
											output: message.usage_metadata.output_tokens,
										},
									});
								}
							}
						}
					}

					if (message.getType() === "tool") {
						dispatch({
							type: "UPDATE_TOOL_CALL_MESSAGE",
							payload: {
								tool_call_id: (message as ToolMessage).tool_call_id!,
								content: message.content as string,
							},
						});
						dispatch({ type: "SET_STATUS", payload: Status.Thinking });
					}
				}
			} finally {
				dispatch({ type: "SET_STATUS", payload: Status.Idle });
			}
		},
		[agent, messages, summary],
	);

	useEffect(() => {
		const initializeAgent = async () => {
			if (agent.current) {
				return; // Agent is already initialized
			}
			const config = loadConfig();
			const model = createModel(config);
			dispatch({ type: "SET_MODEL", payload: config.model });

			if (!fs.existsSync("./.wingman")) {
				fs.mkdirSync("./.wingman", { recursive: true });
			}

			const wingmanAgent = new WingmanAgent({
				name: "Wingman CLI Agent",
				model,
				instructions: getWingmanInstructions(process.cwd()),
				mode: "vibe",
				memory: SqliteSaver.fromConnString("./.wingman/memory.db"),
			});
			await wingmanAgent.initialize();
			agent.current = wingmanAgent;

			if (initialPrompt) {
				void handleSubmit({ input: initialPrompt });
			}
		};
		void initializeAgent();
	}, [initialPrompt, handleSubmit]);

	return (
		<WingmanContext.Provider
			value={{
				messages,
				status,
				input,
				inputTokens,
				outputTokens,
				model,
				contextFiles,
				contextDirectories,
				isContextViewExpanded,
				setInput,
				handleSubmit,
				toggleContextView,
				clearContext,
			}}
		>
			{children}
		</WingmanContext.Provider>
	);
}

export const useWingman = () => {
	const context = useContext(WingmanContext);
	if (!context) {
		throw new Error("useWingman must be used within a WingmanProvider");
	}
	return context;
};
