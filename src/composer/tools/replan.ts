import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlanExecuteState } from "../types/index";
import { buildObjective, formatMessages } from "../utils";
import { ChatOllama } from "@langchain/ollama";
import { AIMessage } from "@langchain/core/messages";

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

const replannerPrompt = ChatPromptTemplate.fromTemplate(
	`Analyze the code changes to determine if they meet the project objective. 
Focus on the implementation and alignment with the goal.

Example JSON Output Structures:

Example 1:
{
  "response": "string",
  "review": {
    "comments": ["string"] (optional)
  }
}

------

Criteria:

1. All code file must be formatted using GitHub-flavored markdown.
2. Implementation completeness and accuracy.
3. Correct import paths and necessary file modifications. 
  - Example: if a new file is created, ensure it is imported correctly.
  - Example: if a new method was imported, ensure it was created.
4. Identify unrelated changes.

Note: Exclude suggestions for testing, monitoring, optimization, coding standards, documentation, or additional reviews unless specified in the objective.

{{objective}}

Project Details: 

{{details}}

-----

Modified/Created Files: 

{{files}}

-----

Guidelines:

If objective met: Use 'response' for concise summary.
If improvements needed: Create review comments required to meet objective.

Action:

If objective reasonably met, use 'response' only.
If objective not met, provide review comments.`,
	{
		templateFormat: "mustache",
	}
);

export class Replanner {
	replanner: ReturnType<typeof replannerPrompt.pipe>;

	constructor(
		private readonly chatModel: BaseChatModel,
		private readonly workspace: string
	) {
		const model = this.chatModel.withStructuredOutput(plan, {
			name: "replan",
		});

		this.replanner =
			this.chatModel instanceof ChatOllama
				? replannerPrompt.pipe(this.chatModel)
				: replannerPrompt.pipe(model);
	}

	replanStep = async (
		state: PlanExecuteState
	): Promise<Partial<PlanExecuteState>> => {
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
			details: state.projectDetails || "Not available.",
			objective: buildObjective(state),
			files: `${
				codeFiles
					? "---FILE---\n\n" + codeFiles
					: "No files were modified as part of this change."
			}`,
		})) as ReplanSchema | AIMessage;

		let result: ReplanSchema = output as ReplanSchema;
		if (this.chatModel instanceof ChatOllama) {
			const response = (output as AIMessage).content.toString();
			result = JSON.parse(response) as ReplanSchema;
		}

		return {
			review: result.review,
			response: result.response,
			plan: state.plan,
			retryCount: state.retryCount ? state.retryCount + 1 : 1,
		};
	};
}
