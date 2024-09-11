import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlanExecuteState } from "../types/index.js";
import { formatMessages } from "../utils.js";
import { ProjectDetailsHandler } from "../../server/project-details.js";
import { codeWriterSchema, codeWriterTool } from "./code-writer.js";
import { ChatAnthropic } from "@langchain/anthropic";
import { StructuredToolParams } from "@langchain/core/tools";

export type ReplanSchema = z.infer<typeof plan>;

const plan = z.object({
	response: z
		.string()
		.describe("Response to user in a Github markdown format."),
});
const response = zodToJsonSchema(plan);

const responseTool = {
	type: "function",
	function: {
		name: "response",
		description: "Response to user.",
		parameters: response,
	},
};

const replannerPrompt = ChatPromptTemplate.fromTemplate(
	`Evaluate if the given objective is met based on the provided files, changes, analysis, and code review. 
If additional steps are needed, inform the user concisely. Accept the solution if it reasonably meets the objective with acceptable quality.

Objective: User's request for project enhancements.
Steps: A list of steps to accomplish the objective.
Files: Code files and changes made.

Code Review Criteria:

1. Examine the code and the changes thoroughly, noting potential issues or improvements.
2. Verify implementation accuracy and alignment with objective and requirements.
3. Assess:
   - Code cleanliness and completeness
   - Objective fulfillment
   - Implementation correctness
   - Import statement paths
   - Extraneous changes
   - If all code has been written, validate import statements and that all files have been modified or created.
4. Code will be in GitHub flavored markdown format, if it is not reject the code and ask for it to be in markdown format.
5. Your review response should use GitHub flavored markdown format.

Avoid suggesting:
- Any form of testing, unless explicity asked for in the objective
- Observability or monitoring
- Performance-related activities
- Coding standards
- Documentation tasks
- External or additional reviews
- Further analysis beyond what's provided

Project details:

{details}

-----

{objective}

-----

Files that have been created or modified:

{files}

-----

Update your plan accordingly. If no more steps are needed and you can return to the user, then respond with that and use the 'response' function.
Otherwise, fill out the plan.  
Only add steps to the plan that still NEED to be done. Do not return previously done steps as part of the plan.`
);

export class Replanner {
	replanner: ReturnType<typeof replannerPrompt.pipe>;
	parser = new JsonOutputToolsParser();

	constructor(
		private readonly chatModel: BaseChatModel,
		private readonly workspace: string
	) {
		let toolInstance;
		if (this.chatModel instanceof ChatAnthropic) {
			toolInstance = this.chatModel.bindTools([
				{
					name: "replan",
					description: "Use this tool to correct the output.",
					schema: codeWriterSchema,
				} satisfies StructuredToolParams,
				{
					name: "response",
					description: "Sends the response to the user.",
					schema: plan,
				} satisfies StructuredToolParams,
			]);
			this.replanner = replannerPrompt.pipe(toolInstance);
		} else {
			//@ts-expect-error
			toolInstance = this.chatModel.bindTools([
				codeWriterTool,
				responseTool,
			]);
			this.replanner = replannerPrompt
				.pipe(toolInstance)
				.pipe(this.parser);
		}
	}

	private buildObjective(state: PlanExecuteState) {
		let objective = `Objective:

${formatMessages(state.messages)}`;

		if (state.followUpInstructions.length > 0) {
			objective = `The user has provided the following instructions to refine the code you've already written or modified:
    
${formatMessages(state.followUpInstructions)}`;
		}

		return objective;
	}

	replanStep = async (
		state: PlanExecuteState
	): Promise<Partial<PlanExecuteState>> => {
		const projectDetails = new ProjectDetailsHandler(
			this.workspace,
			undefined
		);
		const details = await projectDetails.retrieveProjectDetails();

		const codeFiles = state.plan?.files
			?.map((f) => {
				return `File:
${f.file}

Changes made:
- ${f.changes?.join("\n- ")}

Code:
${f.code}`;
			})
			.join("\n\n-----\n\n");

		const output = await this.replanner.invoke({
			details: details?.description || "Not available.",
			objective: this.buildObjective(state),
			files:
				codeFiles || "No files were modified as part of this change.",
		});
		// OpenAI and Anthropic tool responses differ, try to handle them both.
		if (Array.isArray(output)) {
			const toolCall = output[0];

			if (toolCall.type === "response") {
				return {
					response: toolCall.args?.response,
					plan: state.plan,
				};
			}

			return { plan: toolCall.args?.steps };
		}

		// TODO - figure out langchain typing
		//@ts-expect-error
		const toolCall = output.content[1];

		if (toolCall.name === "response") {
			return {
				response: toolCall.input.response,
				plan: state.plan,
			};
		}
		// TODO - This is untested
		return { plan: toolCall.args?.steps };
	};
}
