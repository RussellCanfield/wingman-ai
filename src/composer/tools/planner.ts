import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { VectorQuery } from "../../server/query";
import { CodeGraph } from "../../server/files/graph";
import { Store } from "../../store/vector";
import { ProjectDetailsHandler } from "../../server/project-details";
import { buildObjective, formatMessages } from "../utils";
import { PlanExecuteState } from "../types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";

export type PlannerSchema = z.infer<typeof planSchema>;

const planSchema = z.object({
	steps: z
		.array(z.string())
		.describe("A list of steps to follow to complete the task."),
});

const plannerPrompt = ChatPromptTemplate.fromTemplate(
	`You are an expert software engineer tasked with planning a feature implementation. Your goal is to provide a concise, step-by-step plan based on the given information.
Given:

Objective: {{objective}}
Project overview: {{details}}
Relevant code files

Instructions:

Analyze the objective and project details.
Review the provided code files, determine how they fit in with the objective.
Develop a clear, numbered list of implementation steps.
Each step should be concise yet informative.
Focus on practical actions required to implement the feature.
Include any necessary setup or preparation steps.
Address potential challenges or optimizations within the steps.
Ensure the steps are in a logical order for implementation.
Do not mention writing unit tests unless explicitly requested.
Do not mention having the team review, talking with the team, or any other team-related activities.
Do not include deploying the application or checking application logs.
Ensure you use the 'planner' tool.

Output only a list of implementation steps, these must be in a JSON array. Do not include any additional explanations or commentary.

Example JSON Output Structures:

Example 1:
{
  "steps": ["Install the react-icons package", "Create a new component named 'Icon'"]
}

------

Here are the relevant code files:

{{files}}`,
	{
		templateFormat: "mustache",
	}
);

export class CodePlanner {
	model: ReturnType<typeof BaseChatModel.prototype.withStructuredOutput>;
	codePlanner: ReturnType<typeof plannerPrompt.pipe>;
	vectorQuery = new VectorQuery();

	constructor(
		private readonly chatModel: BaseChatModel,
		private readonly rerankModel: BaseChatModel,
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

		const objective = buildObjective(state);

		state.plan = state.plan || { files: [], steps: [] };

		if (!state.plan.files || state.plan.files.length === 0) {
			const starterDocs =
				await this.vectorQuery.retrieveDocumentsWithRelatedCodeFiles(
					objective,
					this.codeGraph,
					this.store,
					this.workspace,
					15
				);
			state.plan.files = Array.from(starterDocs.entries()).map(
				([file, doc]) => ({
					file,
					code: doc.getText(),
				})
			);
		}

		const rerankedDocs = new Map<string, TextDocument>();
		try {
			const rerankResults = await this.rerankModel.invoke(
				`You are a reranking assistant. 
Your task is to evaluate and rank a set of search results based on their relevance to a given query. 
Please consider factors such as topical relevance, information quality, and how well each result addresses the user's likely intent.

Query: ${objective}

Results to rank:
${state.plan.files.map((f, index) => {
	return `${index + 1}. ${f.file}\n${f.code}\n\n-----FILE-----\n\n`;
})}

Please analyze these results and provide a ranked list from most relevant to least relevant. For each result, only return the new ranking index. Your response should be in this format:

Ranked results:
[Number from original results]
[Number from original results]
        `
			);
			const rerankedResults = rerankResults.content
				.toString()
				.split("\n")
				.filter(
					(line) => line.trim() !== "" && !isNaN(Number(line.trim()))
				)
				.map((line) => parseInt(line.trim()));

			rerankedResults.slice(0, 5).forEach((result, newIndex) => {
				const originalFile = state.plan?.files![result - 1];
				rerankedDocs.set(
					originalFile!.file,
					TextDocument.create(
						originalFile!.file,
						"plaintext",
						0,
						originalFile!.code || ""
					)
				);
			});
		} catch (e) {
			console.error("Failed to rerank", e);
		}

		const finalDocs =
			rerankedDocs.size > 0
				? rerankedDocs
				: new Map(
						state.plan.files.map((file) => [
							file.file,
							TextDocument.create(
								file.file,
								"plaintext",
								0,
								file.code || ""
							),
						])
				  );

		const filesPrompt = Array.from(finalDocs.entries())
			.map(([file, doc]) => `File:\n${file}\n\nCode:\n${doc.getText()}`)
			.join("\n\n---FILE---\n");

		const result = (await this.codePlanner.invoke({
			details: details?.description || "Not available.",
			files: filesPrompt,
			objective,
		})) as PlannerSchema;

		return {
			steps: result.steps,
			projectDetails: details?.description,
			plan: {
				files: Array.from(finalDocs.values()).map((doc) => ({
					file: doc.uri,
					code: doc.getText(),
				})),
				steps: [],
			},
		} satisfies Partial<PlanExecuteState>;
	};
}
