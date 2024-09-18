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
			comments: z.array(z.string()).optional(),
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
	`Analyze the code changes to determine if they meet the project objective. Focus on implementation and alignment with the goal.

Objective: 

{objective}

-----

Project Details: 

{details}

-----

Modified/Created Files: 

{files}

-----

Output:

response: Brief summary of changes made.
review: Array of comments for immediate attention if objective not met. If it was met, return a review with an empty array for comments.

Criteria:

GitHub-flavored markdown for code.
Implementation completeness and accuracy.
Correct import paths and necessary file modifications.
Identify unrelated changes.

Guidelines:

If objective met: Use 'response' for concise summary.
If improvements needed: List essential tasks to meet objective.

Note: Exclude suggestions for testing, monitoring, optimization, coding standards, documentation, or additional reviews unless specified in the objective.
Action:

If objective reasonably met, use 'response' only.
If objective not met, provide review comments.`
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
			retryCount: state.retryCount ? state.retryCount + 1 : 1,
		};
	};
}
