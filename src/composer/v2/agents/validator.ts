import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlanExecuteState } from "../types";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate, HumanMessagePromptTemplate, PromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { AIProvider } from "../../../service/base";
import { createCommandExecuteTool } from "../tools/cmd_execute";
import { ValidationSettings } from "@shared/types/Settings";
import { ChatMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

const FILE_SEPARATOR = "<FILE_SEPARATOR>";
const validatorPrompt = `You are a senior full-stack developer with exceptional technical expertise, focused on reviewing code changes.
Your main goal is to validate code changes against an implementation plan.
Do not mention tool names to the user.
Provide a short and concise report on your validation results.
Do not mention exit codes or low level details to the user.

**Analysis Rules:**
- Verify that the code changes achieved the objective illustrated by the implementation plan
- Verify the quality of the changes meet your standards
- Verify the code is actually integrated properly into the application
- Verify no extraneous code was removed, or the file was altered in a way outside of the scope of the implementation plan
- Verify the validation command runs without error

**Validation Command Result Handling:**
- If the validation command indicates a non-zero exit code or the output indicates an error:
	- Provide specific errors along with any relevant files
	- Provide a summary with details on how you might fix it but do not ask the user if they want it fixed, just say you will fix it and how
- If the command exits with a 0 code and the output looks successful, reply and mention validation succeeded

**Tools:**
- The validation command will be provided by the user as a means to verify the solution
- Use the command_execute tool to execute the validate command
- Do not run destructive commands! Simply tell the user you cannot and why
- Run the validation command ONE TIME. Do not run it per file, RUN IT ONCE!!!

Project Details:
{{projectdetails}}

Implementation Plan:
{{implementationplan}}

Files:
{{files}}
`;

export class Validator {
	private readonly tools: DynamicStructuredTool<any>[];
	private readonly model: BaseChatModel;

	constructor(
		private readonly aiProvider: AIProvider,
		private readonly validationSettings: ValidationSettings,
		private readonly workspace: string,
	) {
		this.tools = [
			createCommandExecuteTool(this.workspace)
		];
		this.model = this.aiProvider.getModel();
	}

	validate = async (state: PlanExecuteState) => {
		if (!this.validationSettings.validationCommand) {
			return {
				messages: state.messages
			}
		}

		const executeStep = async (includeImage: boolean) => {
			const humanMsg = [];
			let buffer = 'Validating changes...\n';

			if (includeImage && state.image) {
				humanMsg.push({
					type: "image_url",
					image_url: {
						url: "{{imageurl}}",
					}
				});
			}

			humanMsg.push({
				type: "text",
				text: "{{input}}"
			});

			const systemTemplate = PromptTemplate.fromTemplate(validatorPrompt,
				{ templateFormat: "mustache" }
			);

			const humanTemplate = PromptTemplate.fromTemplate(
				JSON.stringify(humanMsg),
				{ templateFormat: "mustache" }
			);

			const baseMessages = [
				new SystemMessagePromptTemplate(systemTemplate),
				new HumanMessagePromptTemplate(humanTemplate)
			];

			const chatPrompt = ChatPromptTemplate.fromMessages([
				...baseMessages,
				["placeholder", "{agent_scratchpad}"]
			]);

			// Prepare the variables for formatting
			const variables = {
				projectdetails: state.projectDetails || "Not available.",
				implementationplan: state.implementationPlan!,
				files: state.files
					?.map((f) => `${FILE_SEPARATOR}\nFile: ${f.path}\nDescription: ${f.description}\nCode:\n${f.code ?? "(New File)"}`)
					.join(`\n\n${FILE_SEPARATOR}\n\n`) || "",
				input: `Please use the following command to validate: ${this.validationSettings.validationCommand}`,
				imageurl: state.image?.data
			};

			try {
				const agent = createToolCallingAgent({
					llm: this.model,
					tools: this.tools,
					prompt: chatPrompt,
				});

				const executor = new AgentExecutor({
					agent,
					tools: this.tools
				});

				await dispatchCustomEvent("composer-message-stream", buffer);

				for await (const event of await executor.streamEvents(
					variables,
					{ version: "v2" }
				)) {
					switch (event.event) {
						case "on_chat_model_stream":
							if (event.data.chunk?.content) {
								const chunk = Array.isArray(event.data.chunk.content) ?
									event.data.chunk.content[0]?.text || ''
									:
									event.data.chunk.content.toString();

								buffer += chunk;

								await dispatchCustomEvent("composer-message-stream", buffer);
							}
							break;
					}
				}
			} catch (error) {
				const errorMessage = error?.toString?.() || '';
				if (includeImage && (
					errorMessage.includes('image') ||
					errorMessage.includes('multimodal') ||
					errorMessage.includes('unsupported')
				)) {
					await dispatchCustomEvent("composer-warning", {
						warning: "Image processing not supported by the model. Retrying without image...",
					});
					return false;
				}
				throw error;
			}

			return buffer;
		};

		if (!this.validationSettings || !this.validationSettings.validationCommand) {
			return {
				messages: state.messages
			}
		}

		let buffer = await executeStep(true);
		if (!buffer && state.image) {
			buffer = await executeStep(false);
		}

		const messages: ChatMessage[] = [...state.messages, new ChatMessage(buffer || "", "assistant")];

		const decisionModel = this.aiProvider.getLightweightModel();
		const didSucceed = await decisionModel.invoke(`You are a senior full-stack developer with exceptional technical expertise, focused on reviewing terminal output from a command.
The following command was executed: ${this.validationSettings?.validationCommand ?? ""}

Command output along with analysis:
${buffer}

----

Respond with a "1" if the command succeeded, respond with a "0" if the command failed.

Do not include any other content or explanations.
Do not respond using markdown or any other format.`);

		await dispatchCustomEvent("composer-message-stream-finish",
			{
				messages
			}
		)

		if (didSucceed.content.toString().includes("0")) {
			return new Command({
				goto: "find",
				update: {
					messages
				}
			})
		}

		return new Command({
			goto: "midscene-tester",
			update: {
				messages
			}
		})
	}
}