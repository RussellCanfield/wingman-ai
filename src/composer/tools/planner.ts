import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { VectorQuery } from "../../server/query";
import { CodeGraph } from "../../server/files/graph";
import { Store } from "../../store/vector";
import { ProjectDetailsHandler } from "../../server/project-details";
import { formatMessages } from "../utils";
import { PlanExecuteState } from "../types";
import { ChatMessage } from "@langchain/core/messages";

export type PlannerSchema = z.infer<typeof planSchema>;

const planSchema = z.object({
	questions: z
		.array(z.string())
		.describe(
			"questions for refining the objective from a code perspective"
		),
});
const plan = zodToJsonSchema(planSchema);
const planFunction = {
	name: "plan",
	description:
		"This tool is used to refine the objective from a code perspective",
	parameters: plan,
};

const planTool = {
	type: "function",
	function: planFunction,
};

const plannerPrompt = ChatPromptTemplate.fromTemplate(
	`You are an expert software engineer planning to implement a feature in a project.

You will be given the following information:
- An objective which represents the user's request.
- An overview about the type of project you are working with.
- A set of code files related to the project.

Tasks:
1. Analyze the objective and understand the requirements.
2. Identify relevant files in the project.
3. Based on the objective determine if more files are needed.
4. Develop a set of questions that will help you refine the objective from a code perspective.

Question refinement:
- You may need to know more about the data structure, the user interface, or the business logic.
- Be very specific, your questions will be used in vector retrieval to find relevant code examples.

Examples:
- What is the entry point of the application?
- What state management library is being used?
- What is the data structure of the "User" object?
- What files are related to the "User" object?


Project details:

{details}

----

Objective:

{objective}`
);

export class CodePlanner {
	model: ReturnType<typeof BaseChatModel.prototype.withStructuredOutput>;
	codePlanner: ReturnType<typeof plannerPrompt.pipe>;
	vectorQuery = new VectorQuery();

	constructor(
		private readonly chatModel: BaseChatModel,
		private readonly workspace: string,
		private readonly codeGraph: CodeGraph,
		private readonly store: Store
	) {
		//@ts-expect-error
		this.model = this.chatModel.withStructuredOutput(planSchema, {
			name: "planner",
		});
		this.codePlanner = plannerPrompt.pipe(this.model);
	}

	codePlannerStep = async (state: PlanExecuteState) => {
		const projectDetails = new ProjectDetailsHandler(
			this.workspace,
			undefined
		);
		const details = await projectDetails.retrieveProjectDetails();

		const context =
			state.followUpInstructions.length > 0
				? formatMessages(state.followUpInstructions)
				: formatMessages(state.messages);

		const result = (await this.codePlanner.invoke({
			details: details?.description || "Not available.",
			objective: context,
		})) as PlannerSchema;

		return {
			plannerQuestions: result.questions,
		};
	};
}
