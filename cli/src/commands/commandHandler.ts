import type { WingmanAgent, WingmanRequest } from "@wingman-ai/agent";
import type { Message } from "src/contexts/types";
import { Status } from "src/contexts/types";
import { ConversationRetriever } from "src/persistence/conversationManager";
import { v4 as uuidv4 } from "uuid";
import os from "node:os";
import { getPlanningPrompt } from "./planning";

type CommandHandlerParams = {
	request: WingmanRequest;
	agent: React.MutableRefObject<WingmanAgent | null>;
	threadId: React.MutableRefObject<string>;
	dispatch: React.Dispatch<any>;
};

export const handleCommand = async ({
	request,
	agent,
	threadId,
	dispatch,
}: CommandHandlerParams): Promise<boolean> => {
	const command = request.input.trim();

	switch (command) {
		case "/hotkeys": {
			const isMac = os.platform() === "darwin";
			const toggleKey = isMac ? "Cmd+B" : "Ctrl+B";
			const clearKey = isMac ? "Cmd+D" : "Ctrl+D";
			const hotkeyMessage: Message = {
				id: uuidv4(),
				type: "ai",
				content: `Here are the available hotkeys:\n\n- **${toggleKey}**: Toggle context view\n- **${clearKey}**: Clear context files and directories`,
			};
			dispatch({ type: "ADD_MESSAGE", payload: hotkeyMessage });
			dispatch({ type: "SET_INPUT", payload: "" });
			return true;
		}
		case "/init": {
			request.input = getPlanningPrompt();
			return false; // Allow handleSubmit to process this as a normal message
		}
		case "/resume": {
			const manager = new ConversationRetriever("./.wingman/memory.db");
			const conversations = manager.getAllConversations();
			if (conversations.length > 0) {
				const lastConversation = conversations[conversations.length - 1];
				threadId.current = lastConversation.threadId;
				const resumeMessage: Message = {
					id: uuidv4(),
					type: "ai",
					content: `Resumed conversation from thread ${lastConversation.threadId}.`,
				};
				dispatch({ type: "ADD_MESSAGE", payload: resumeMessage });
			} else {
				const noConversationMessage: Message = {
					id: uuidv4(),
					type: "ai",
					content: "No previous conversations found to resume.",
				};
				dispatch({ type: "ADD_MESSAGE", payload: noConversationMessage });
			}
			dispatch({ type: "SET_INPUT", payload: "" });
			return true;
		}
		case "/compact": {
			if (!agent.current) return true;
			dispatch({ type: "SET_STATUS", payload: Status.Compacting });
			await agent.current.compactMessages(threadId.current);
			dispatch({ type: "COMPACT", payload: "" });
			const compactMessage: Message = {
				id: uuidv4(),
				type: "ai",
				content:
					"Conversation compacted. The summary will be used as context for the next message.",
			};
			dispatch({ type: "ADD_MESSAGE", payload: compactMessage });
			dispatch({ type: "SET_STATUS", payload: Status.Idle });
			dispatch({ type: "SET_INPUT", payload: "" });
			return true;
		}
		default:
			return false;
	}
};
