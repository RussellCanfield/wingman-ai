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
import { agentLogger, logAgentInteraction, logError, logPerformance } from "../utils/logger";

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
		agentLogger.trace({
			event: 'input_set',
			isFunction: typeof input === 'function',
			newLength: typeof input === 'string' ? input.length : undefined
		}, 'Input value being set');
		dispatch({ type: "SET_INPUT", payload: input });
	};

	const toggleContextView = useCallback(() => {
		agentLogger.debug({ event: 'toggle_context_view' }, 'Context view toggled');
		dispatch({ type: "TOGGLE_CONTEXT_VIEW" });
	}, []);

	const clearContext = useCallback(() => {
		agentLogger.info({
			event: 'clear_context',
			clearedFiles: contextFiles.length,
			clearedDirectories: contextDirectories.length
		}, 'Context cleared by user');
		dispatch({ type: "CLEAR_CONTEXT" });
	}, [contextFiles.length, contextDirectories.length]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	const handleSubmit = useCallback(
		async (request: WingmanRequest) => {
			const submitStartTime = Date.now();
			const originalInput = request.input;

			agentLogger.info({
				event: 'submit_start',
				inputLength: originalInput.length,
				hasContextFiles: !!request.contextFiles?.length,
				hasContextDirectories: !!request.contextDirectories?.length,
				contextFilesCount: request.contextFiles?.length || 0,
				contextDirectoriesCount: request.contextDirectories?.length || 0
			}, 'Starting request submission');

			try {
				const commandHandled = await handleCommand({
					request,
					agent,
					threadId,
					dispatch,
				});

				if (commandHandled) {
					logPerformance('WingmanContext', 'command_handling', Date.now() - submitStartTime, {
						command: originalInput,
						handled: true
					});
					return;
				}

				if (!agent.current) {
					agentLogger.error({ event: 'agent_not_initialized' }, 'Agent not initialized when trying to submit');
					return;
				}

				if (request.contextFiles) {
					agentLogger.debug({
						event: 'context_files_added',
						files: request.contextFiles
					}, `Adding ${request.contextFiles.length} context files`);
					dispatch({
						type: "ADD_CONTEXT_FILES",
						payload: request.contextFiles,
					});
				}

				if (request.contextDirectories) {
					agentLogger.debug({
						event: 'context_directories_added',
						directories: request.contextDirectories
					}, `Adding ${request.contextDirectories.length} context directories`);
					dispatch({
						type: "ADD_CONTEXT_DIRECTORIES",
						payload: request.contextDirectories,
					});
				}

				const humanMessage: Message = {
					id: uuidv4(),
					type: "human",
					content: originalInput,
				};

				agentLogger.debug({
					event: 'human_message_created',
					messageId: humanMessage.id,
					contentLength: originalInput.length
				}, 'Created human message');

				dispatch({ type: "ADD_MESSAGE", payload: humanMessage });
				dispatch({ type: "SET_STATUS", payload: Status.Thinking });
				dispatch({ type: "SET_INPUT", payload: "" });
				dispatch({ type: "SET_CURRENT_AI_MESSAGE_ID", payload: null });

				const finalInput = summary
					? `Summary of previous conversation:\n${summary}\n\nContinue the conversation based on this summary.\n\n${request.input}`
					: request.input;

				const fullRequest: WingmanRequest = {
					...request,
					input: finalInput,
					threadId: threadId.current,
				};

				agentLogger.info({
					event: 'agent_stream_start',
					threadId: threadId.current,
					hasSummary: !!summary,
					finalInputLength: finalInput.length,
					fullRequest
				}, 'Starting agent stream');

				const streamStartTime = Date.now();
				let messageCount = 0;
				let toolCallCount = 0;

				for await (const res of agent.current.stream(fullRequest)) {
					const { messages: newMessages } = res as WingmanGraphState;
					const message = newMessages[newMessages.length - 1] as BaseMessage;
					messageCount++;

					agentLogger.trace({
						event: 'stream_message_received',
						messageType: message.getType(),
						messageIndex: messageCount,
						hasContent: !!message.content,
						hasToolCalls: !!(message as any).tool_calls?.length,
						hasUsageMetadata: !!(message as any).usage_metadata
					}, `Received stream message ${messageCount}: ${message.getType()}`);

					if (message instanceof AIMessageChunk || message instanceof AIMessage) {
						dispatch({ type: "HANDLE_AI_MESSAGE", payload: { message } });
						if (message.usage_metadata) {
							agentLogger.debug({
								event: 'tokens_received',
								inputTokens: message.usage_metadata.input_tokens,
								outputTokens: message.usage_metadata.output_tokens,
								totalTokens: message.usage_metadata.total_tokens
							}, 'Token usage updated');
							dispatch({
								type: "ADD_TOKENS",
								payload: {
									input: message.usage_metadata.input_tokens,
									output: message.usage_metadata.output_tokens,
								},
							});
						}

						if (message.tool_calls && message.tool_calls.length > 0) {
							agentLogger.debug({
								event: 'tool_calls_detected',
								toolCalls: message.tool_calls.length,
								messageId: message.id
							}, `Detected ${message.tool_calls.length} tool calls in message ${message.id}`);
							dispatch({
								type: "ADD_TOOL_CALLS",
								payload: {
									toolCalls: message.tool_calls,
									messageId: message.id,
								},
							});
						}
					}

					if (message.getType() === "tool") {
						toolCallCount++;
						agentLogger.info({
							event: 'tool_message_received',
							toolCallId: (message as ToolMessage).tool_call_id,
							toolCallIndex: toolCallCount,
							contentLength: (message.content as string)?.length || 0
						}, `Tool message ${toolCallCount} received`);
						dispatch({
							type: "HANDLE_TOOL_MESSAGE",
							payload: { message: message as ToolMessage },
						});
					}
				}

				const streamDuration = Date.now() - streamStartTime;
				logPerformance('WingmanContext', 'agent_stream', streamDuration, {
					messageCount,
					toolCallCount,
					inputLength: originalInput.length
				});

			} catch (error) {
				logError('WingmanContext', error as Error, {
					event: 'submit_error',
					originalInput,
					threadId: threadId.current,
					hasAgent: !!agent.current
				});
				dispatch({ type: "HANDLE_AI_MESSAGE", payload: { message: new AIMessage({ content: `Error during request submission: ${(error as Error).message}` }) } });
			} finally {
				agentLogger.debug({ event: 'submit_complete' }, 'Request submission completed');
				dispatch({ type: "SET_STATUS", payload: Status.Idle });
				dispatch({ type: "SET_CURRENT_AI_MESSAGE_ID", payload: null });

				const totalDuration = Date.now() - submitStartTime;
				logPerformance('WingmanContext', 'total_submit', totalDuration, {
					inputLength: originalInput.length
				});
			}
		},
		[summary, contextFiles.length, contextDirectories.length],
	);

	useEffect(() => {
		const initializeAgent = async () => {
			if (agent.current) {
				agentLogger.debug({ event: 'agent_already_initialized' }, 'Agent already initialized, skipping');
				return;
			}

			const initStartTime = Date.now();
			agentLogger.info({ event: 'agent_init_start' }, 'Starting agent initialization');

			try {
				const config = loadConfig();
				const model = createModel(config);

				agentLogger.debug({
					event: 'config_loaded',
					model: config.model
				}, `Configuration loaded with model: ${config.model}`);

				dispatch({ type: "SET_MODEL", payload: config.model });

				if (!fs.existsSync("./.wingman")) {
					fs.mkdirSync("./.wingman", { recursive: true });
					agentLogger.debug({ event: 'wingman_dir_created' }, 'Created .wingman directory');
				}

				const wingmanAgent = new WingmanAgent({
					name: "Wingman CLI Agent",
					model,
					instructions: getWingmanInstructions(process.cwd()),
					mode: "vibe",
					memory: SqliteSaver.fromConnString("./.wingman/memory.db"),
				});

				agentLogger.debug({ event: 'agent_created' }, 'WingmanAgent instance created');

				await wingmanAgent.initialize();
				agent.current = wingmanAgent;

				const initDuration = Date.now() - initStartTime;
				logPerformance('WingmanContext', 'agent_initialization', initDuration);

				agentLogger.info({
					event: 'agent_init_complete',
					duration: initDuration
				}, `Agent initialized successfully in ${initDuration}ms`);

				if (initialPrompt) {
					agentLogger.info({
						event: 'initial_prompt_submit',
						promptLength: initialPrompt.length
					}, 'Submitting initial prompt');
					void handleSubmit({ input: initialPrompt });
				}
			} catch (error) {
				const initDuration = Date.now() - initStartTime;
				logError('WingmanContext', error as Error, {
					event: 'agent_init_error',
					duration: initDuration
				});
			}
		};

		void initializeAgent();
	}, [initialPrompt, handleSubmit]);

	// Log context provider mount/unmount
	useEffect(() => {
		agentLogger.info({
			event: 'context_provider_mount',
			hasInitialPrompt: !!initialPrompt
		}, 'WingmanProvider mounted');

		return () => {
			agentLogger.info({ event: 'context_provider_unmount' }, 'WingmanProvider unmounted');
		};
	}, [initialPrompt]);

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
