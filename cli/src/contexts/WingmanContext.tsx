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
import { MemorySaver } from "@langchain/langgraph";
import {
	useState,
	useEffect,
	useCallback,
	useRef,
	createContext,
	type ReactNode,
	useContext,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { loadConfig, createModel } from "../config/";
import { getWingmanInstructions } from "src/config";

export enum Status {
	Idle = 0,
	Thinking = 1,
	ExecutingTool = 2,
}

export interface Message {
	id: string;
	type: "human" | "ai" | "tool";
	content: string;
	args?: Record<string, unknown>;
	toolName?: string;
	tokenCount?: number;
	toolStatus?: "executing" | "finished";
}

export interface WingmanContextType {
	messages: Message[];
	status: Status;
	input: string;
	totalTokens: number;
	contextFiles: string[];
	contextDirectories: string[];
	isContextViewExpanded: boolean;
	setInput: (input: string) => void;
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
	const [messages, setMessages] = useState<Message[]>([]);
	const [status, setStatus] = useState<Status>(Status.Idle);
	const [input, setInput] = useState<string>("");
	const [totalTokens, setTotalTokens] = useState<number>(0);
	const [contextFiles, setContextFiles] = useState<string[]>([]);
	const [contextDirectories, setContextDirectories] = useState<string[]>([]);
	const [isContextViewExpanded, setIsContextViewExpanded] = useState(false);

	const agent = useRef<WingmanAgent | null>(null);
	const checkpointer = useRef<MemorySaver | null>(null);
	const threadId = useRef<string>(uuidv4());

	const toggleContextView = useCallback(() => {
		setIsContextViewExpanded((prev) => !prev);
	}, []);

	const clearContext = useCallback(() => {
		setContextFiles([]);
		setContextDirectories([]);
	}, []);

	const handleSubmit = useCallback(
		async (request: WingmanRequest) => {
			if (!agent.current || !checkpointer.current) return;

			if (request.contextFiles) {
				setContextFiles((prev) => [
					...new Set([...prev, ...request.contextFiles!]),
				]);
			}
			if (request.contextDirectories) {
				setContextDirectories((prev) => [
					...new Set([...prev, ...request.contextDirectories!]),
				]);
			}

			const humanMessage: Message = {
				id: uuidv4(),
				type: "human",
				content: request.input,
			};
			setMessages((prev) => [...prev, humanMessage]);
			setStatus(Status.Thinking);
			setInput("");

			const fullRequest: WingmanRequest = {
				...request,
				threadId: threadId.current,
			};

			let currentAiMessageId: string | null = null;

			try {
				for await (const res of agent.current.stream(
					fullRequest,
					checkpointer.current,
				)) {
					const { messages: newMessages } = res as WingmanGraphState;
					const message = newMessages[newMessages.length - 1] as BaseMessage;

					if (message instanceof AIMessageChunk || message instanceof AIMessage) {
						if (message.tool_calls && message.tool_calls.length > 0) {
							setMessages((prev) => {
								const existingToolCallIds = new Set(
									prev.filter((m) => m.type === "tool").map((m) => m.id),
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
									setStatus(Status.ExecutingTool);
									return [...prev, ...newToolCallMessages];
								}
								return prev;
							});
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
								if (message.usage_metadata?.total_tokens) {
									setTotalTokens(
										(prev) => prev + message.usage_metadata!.total_tokens,
									);
								}
								setMessages((prev) => [...prev, newAiMessage]);
							} else {
								setMessages((prev) => {
									const lastMessage = prev[prev.length - 1];
									if (lastMessage && lastMessage.id === currentAiMessageId) {
										lastMessage.content += message.content;
										if (message.usage_metadata?.total_tokens) {
											lastMessage.tokenCount =
												message.usage_metadata.total_tokens;
											setTotalTokens(
												(prevTotal) =>
													prevTotal + message.usage_metadata!.total_tokens,
											);
										}
										return [...prev.slice(0, -1), lastMessage];
									}
									return prev;
								});
							}
						}
					}

					if (message.getType() === "tool") {
						setMessages((prev) =>
							prev.map((m) => {
								if (m.id === (message as ToolMessage).tool_call_id) {
									return {
										...m,
										type: "tool",
										content: message.content as string,
										toolStatus: "finished",
									};
								}
								return m;
							}),
						);
						setStatus(Status.Thinking);
					}
				}
			} finally {
				setStatus(Status.Idle);
			}
		},
		[],
	);

	useEffect(() => {
		const initializeAgent = async () => {
			const config = loadConfig();
			const model = createModel(config);

			const wingmanAgent = new WingmanAgent({
				name: "Wingman CLI Agent",
				model,
				instructions: getWingmanInstructions(process.cwd()),
				mode: "vibe",
				workingDirectory: process.cwd(),
			});
			await wingmanAgent.initialize();
			agent.current = wingmanAgent;
			checkpointer.current = new MemorySaver();

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
				totalTokens,
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
