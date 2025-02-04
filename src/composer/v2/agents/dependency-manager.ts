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
			["human", `You are a seasoned full-stack software architect and technical lead.
Your task is to execute commands and add dependencies to the software project based on the implementation plan.

**Core Rules:**
1. Do not repeat yourself or include code examples
2. Do not mention tool names explicitly
3. Only call tools when necessary
4. Before calling tools, explain why to the user
5. Do not write any code or provide code examples, just focus on dependencies
6. Do not EVER, EVER EVER, delete a file or a directory. Do not. THIS IS CRITICAL!!!

**Protocol:**
- Use **Project details** to determine which commands to run, if not available then guess based on the implementation plan
- Use **Available Files** to guide you on project structure
- Use **Files being modified** to guide you on project language/type
- Use **Dependencies** to determine which ones to add
- The tool command_execute will allow you to execute commands to add dependencies and will report the output
- Keep commands simple and concise, do not run more commands than are necessary

**Details:**
- For javascript/typescript projects use details such as the lock file present to know which package manager to use, if none available default to npm

**Project Details:**
${state.projectDetails || "Not available."}

**Implementation Plan:**
{input}

**Files being modified:**
${state.files?.map(f => `File: ${f.path}`).join('\n')}

**Available Files:**
${contents.map(f => `- ${f.path}`).join('\n')}

**Dependencies being added:**
${state.dependencies?.join('\n')}

**Response Format:**
- Use github markdown and ensure proper syntax
- Do not use tables, just simple bullet point lists

**Response Example:**
[Briefly list and describe the dependencies being added]

[List the command(s) you will execute]

[Do not add a recap or summary section]

[State you are finished and ready to generate code, its a statement not a question]

Remember: 
- Take monorepos into consideration
- Add the dependencies to the correct project if there are multiple
- Focus on the correct language and method to add a dependency (npm, pip, pnpm etc)`],
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

		let buffer = '';
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

		return {
			messages
		} satisfies Partial<PlanExecuteState>;
	}
}