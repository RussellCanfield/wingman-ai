import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlanExecuteState } from "../types";
import { scanDirectory } from "../../utils";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createCommandExecuteTool } from "../tools/cmd_execute";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { ChatMessage } from "@langchain/core/messages";

export class DependencyManager {
	private readonly tools: DynamicStructuredTool<any>[];

	constructor(
		private readonly model: BaseChatModel,
		private readonly workspace: string
	) {
		this.tools = [
			createCommandExecuteTool(this.workspace)
		];
	}

	addDependencies = async (
		state: PlanExecuteState,
	) => {
		const contents = await scanDirectory(this.workspace, 4);

		const prompt = ChatPromptTemplate.fromMessages([
			["human", `You are an experienced dependency management specialist. Your task is to add required dependencies to existing package management files only.

**Core Responsibilities:**
1. Add dependencies to existing package management files
2. Use appropriate syntax for each package manager type
3. Handle monorepos and multi-project setups
4. Do not ask the user for clarifications
5. Do not suggestion possible changes, just focus on your task
6. Do not mention tool names to the user.

**Critical Rules:**
1. Only modify existing dependency files - never create new ones
2. Only proceed if one of these files exists in the provided file lists:
   - package.json (Node.js)
   - requirements.txt (Python)
   - pyproject.toml (Python)
   - build.gradle (Gradle)
   - pom.xml (Maven)
   - Gemfile (Ruby)
   - composer.json (PHP)
   - Cargo.toml (Rust)
   etc.
3. Never attempt to create missing files
4. Never request or read lock files
5. Focus solely on adding dependencies to existing files
6. If no dependency files are found in the provided lists, respond with "Cannot proceed - no dependency management files found in workspace"
7. If "Dependencies to Add" are listed, then execute the proper install commands based on the project type

**Analysis Process:**
1. Verify dependency file existence in provided file lists
2. Identify file format and required syntax
3. Plan dependency additions
4. Modify existing file only

**Input Context:**

Project Details: 
${state.projectDetails || "Not provided"}

Implementation Plan: 
{input}

Files to be Modified or Created: 
${state.files?.map(f => `- ${f.path}`).join('\n')}

Workspace Files: 
${contents.map(f => `- ${f.path}`).join('\n')}

Dependencies to Add: 
${state.dependencies?.join('\n')}

**Response Format:**
1. Dependency File Analysis
   - Identified dependency file(s)
   - Use short and concise language

2. Execution Statement
   - Clear statement using short and concise language for proceeding with file modifications
   - No file creation attempts

**Available Actions:**
- read_file: Read existing dependency files
- command_execute: Run package manager add commands (npm add, pip install, etc.)`],
			["placeholder", "{agent_scratchpad}"],
		]);

		const agent = createToolCallingAgent({
			llm: this.model,
			tools: this.tools,
			prompt
		});

		const executor = new AgentExecutor({
			agent,
			tools: this.tools
		});

		let buffer = 'Analyzing dependencies...\n';
		await dispatchCustomEvent("composer-message-stream", buffer);
		for await (const event of await executor.streamEvents(
			{ input: state.implementationPlan },
			{ version: "v2" }
		)) {
			switch (event.event) {
				case "on_chat_model_stream":
					if (event.data.chunk?.content) {
						if (Array.isArray(event.data.chunk.content)) {
							const text = event.data.chunk.content[0]?.text || '';
							buffer += text;
						} else {
							const text = event.data.chunk.content.toString() || '';
							buffer += text;
						}
						await dispatchCustomEvent("composer-message-stream", buffer);
					}
					break;
			}
		}

		const messages: ChatMessage[] = [...state.messages, new ChatMessage(buffer, "assistant")];

		await dispatchCustomEvent("composer-message-stream-finish", {
			messages
		});

		return {
			messages
		} satisfies Partial<PlanExecuteState>;
	}
}