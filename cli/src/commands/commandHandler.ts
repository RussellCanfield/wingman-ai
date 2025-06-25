import type { WingmanAgent, WingmanRequest } from "@wingman-ai/agent";
import type { Message } from "src/contexts/types";
import { Status } from "src/contexts/types";
import { ConversationRetriever } from "src/persistence/conversationManager";
import { v4 as uuidv4 } from "uuid";
import os from "node:os";

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
			request.input = `
As my expert developer wingman, your first task is to conduct a deep analysis of the current project to build a comprehensive understanding that will guide our collaboration.

Your mission is as follows:

1.  **Explore the Project Structure:**
    *   Begin by listing the files and directories in the current working directory to map out the project's layout.
    *   Identify key directories that likely contain source code, tests, configuration, and documentation by looking for common naming conventions (e.g., \`src\`, \`lib\`, \`app\`, \`tests\`, \`docs\`, \`config\`).

2.  **Identify Core Technologies and Configuration:**
    *   Locate and read critical configuration files to understand how the project is built and managed. Look for dependency management files (like \`package.json\`, \`pom.xml\`, \`requirements.txt\`, \`Gemfile\`), build tool configurations, and language-specific settings.
    *   From these files, determine the primary programming languages, frameworks, libraries, and build tools being used.

3.  **Analyze the Codebase for Key Insights:**
    *   Examine the source code to determine the project's primary purpose and business domain.
    *   Identify the main application entry points, core modules, and key features.
    *   Look for any testing frameworks and directories to understand the project's testing strategy.

4.  **Synthesize and Document Your Findings:**
    *   Consolidate all your findings into a detailed markdown report.
    *   Structure the report with clear headings for each area of analysis (e.g., "Project Overview," "Technologies Used," "Key Directories," "Core Features," "Testing Strategy").

5.  **Save Your Analysis:**
    *   Write the complete markdown report to a file located at \`/.wingman/instructions.md\`. This file will serve as your foundational knowledge base for our work together.

Begin your investigation now. Let me know once you have completed the analysis and created the \`instructions.md\` file.`;
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
