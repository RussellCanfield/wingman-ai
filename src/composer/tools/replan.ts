import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlanExecuteState } from "../types/index.js";
import { formatMessages } from "../utils.js";
import { ProjectDetailsHandler } from "../../server/project-details.js";

export type ReplanSchema = z.infer<typeof plan>;

const plan = z.object({
	response: z
		.string()
		.describe("Response to user in a Github markdown format.")
		.optional(),
	review: z
		.object({
			comments: z.array(z.string()),
		})
		.describe(
			"A review containing a set of comments that require immediate attention."
		)
		.optional(),
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
	`Analyze the provided code changes to determine if they meet the specified objective for the project. Focus solely on the implementation and its alignment with the given goal.

Objective: {objective}

Project Context: {details}

Modified/Created Files:
{files}

Evaluation Criteria:
1. Verify that all code is presented in GitHub-flavored markdown format.
2. Assess the completeness and accuracy of the implementation in relation to the objective.
3. Check for correct import statement paths and ensure all necessary files have been modified or created.
4. Identify any extraneous changes not related to the objective.

Response Guidelines:
- If the objective is met satisfactorily:
  Use the 'response' function to inform the user of successful completion. 
  Provide a short and concise summary of what was done.
  Do not detail whats been done to every file, just provide a brief overview.

- If improvements or corrections are needed:
  Provide a concise list of steps that still need to be completed. Focus only on essential tasks directly related to meeting the objective.

Important: Do not suggest testing, monitoring, performance optimization, coding standards, documentation, or additional reviews unless explicitly requested in the objective.

Action:
1. If the objective was reasonably met, return using the 'response' only.
2. If the objective was not met or changes are required, leave review comments.`
);

export class Replanner {
	model: ReturnType<BaseChatModel["withStructuredOutput"]>;
	replanner: ReturnType<typeof replannerPrompt.pipe>;

	constructor(
		private readonly chatModel: BaseChatModel,
		private readonly workspace: string
	) {
		//@ts-expect-error
		this.model = this.chatModel.withStructuredOutput(plan);
		this.replanner = replannerPrompt.pipe(this.model);
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
			.join("\n\n---FILE--\n\n");

		const output = (await this.replanner.invoke({
			details: details?.description || "Not available.",
			objective: this.buildObjective(state),
			files: `${
				codeFiles
					? "---FILE---\n" + codeFiles
					: "No files were modified as part of this change."
			}`,
		})) as ReplanSchema;

		return {
			review: output.review,
			response: output.response,
			plan: state.plan,
		};
	};
}
