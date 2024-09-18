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
import { TextDocument } from "vscode-languageserver-textdocument";

export type PlannerSchema = z.infer<typeof planSchema>;

const planSchema = z.object({
	steps: z
		.array(z.string())
		.describe("A list of steps to follow to complete the task."),
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
	`You are an expert software engineer tasked with planning a feature implementation. Your goal is to provide a concise, step-by-step plan based on the given information.
Given:

Objective: {objective}
Project overview: {details}
Relevant code files

Instructions:

Analyze the objective and project details.
Review the provided code files.
Develop a clear, numbered list of implementation steps.
Each step should be concise yet informative.
Focus on practical actions required to implement the feature.
Include any necessary setup or preparation steps.
Address potential challenges or optimizations within the steps.
Ensure the steps are in a logical order for implementation.
Do not mention writing unit tests unless explicitly requested.
Do not mention having the team review, talking with the team, or any other team-related activities.
Do not include deploying the application or checking application logs.

Output only the numbered list of implementation steps. Do not include any additional explanations or commentary.

Here are the relevant code files:

{files}`
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

		const context =
			state.followUpInstructions.length > 0
				? formatMessages(state.followUpInstructions)
				: formatMessages(state.messages);

		let starterDocs: Map<string, TextDocument> = new Map();
		const rerankedDocs = new Map();

		if (!state.plan?.files || state.plan.files.length === 0) {
			starterDocs =
				await this.vectorQuery.retrieveDocumentsWithRelatedCodeFiles(
					context,
					this.codeGraph,
					this.store,
					this.workspace,
					15
				);
		}

		try {
			const rerankResults = await this.rerankModel
				.invoke(`You are a reranking assistant. 
Your task is to evaluate and rank a set of search results based on their relevance to a given query. 
Please consider factors such as topical relevance, information quality, and how well each result addresses the user's likely intent.

Query: ${context}

Results to rank:
${Array.from(starterDocs.entries()).map(([file, doc], index) => {
	return `${index + 1}. ${file}\n${doc.getText()}\n\n-----FILE-----\n\n`;
})}

Please analyze these results and provide a ranked list from most relevant to least relevant. For each result, only return the new ranking index. Your response should be in this format:

Ranked results:
[Number from original results]
[Number from original results]
        `);

			const rerankedResults = rerankResults.content
				.toString()
				.split("\n")
				.filter(
					(line) => line.trim() !== "" && !isNaN(Number(line.trim()))
				)
				.map((line) => parseInt(line.trim()));

			rerankedResults.slice(0, 5).forEach((result, newIndex) => {
				const originalIndex = result - 1; // Convert to 0-based index
				const originalKey = Array.from(starterDocs.keys())[
					originalIndex
				];
				rerankedDocs.set(originalKey, starterDocs.get(originalKey)); // Store 1-based new index
			});
		} catch (e) {
			console.error("Failed to rerank", e);
		}

		const finalDocs = rerankedDocs.size > 0 ? rerankedDocs : starterDocs;

		state.plan?.files?.forEach((file) => {
			if (!finalDocs.has(file.file)) {
				finalDocs.set(
					file.file,
					TextDocument.create(
						file.file,
						"plaintext",
						0,
						file.code || ""
					)
				);
			}
		});

		const filesPrompt = Array.from(finalDocs.entries())
			.map(([file, doc]) => {
				return `File:
${file}

Code:
${doc.code}`;
			})
			.join("\n\n---FILE---\n");

		const result = (await this.codePlanner.invoke({
			details: details?.description || "Not available.",
			files: filesPrompt,
			objective: context,
		})) as PlannerSchema;

		return {
			steps: result.steps,
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
