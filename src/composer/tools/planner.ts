import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { VectorQuery } from "../../server/query";
import { CodeGraph } from "../../server/files/graph";
import { Store } from "../../store/vector";
import { ProjectDetailsHandler } from "../../server/project-details";
import { buildObjective } from "../utils";
import { PlanExecuteState } from "../types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ChatOllama } from "@langchain/ollama";
import { AIMessage } from "@langchain/core/messages";
import { FILE_SEPARATOR } from "./common";
import { NoFilesChangedError } from "../errors";
import { loggingProvider } from "../../server/loggingProvider";
import path from "node:path";
import fs from "node:fs";
import { filePathToUri } from "../../server/files/utils";

export type PlannerSchema = z.infer<typeof planSchema>;

const planSchema = z.object({
	plan: z.array(
		z.object({
			file: z.string().describe("The file to create or modify"),
			steps: z
				.array(z.string())
				.describe("A list of steps to follow specific to the file."),
		})
	),
});

const plannerPrompt = ChatPromptTemplate.fromTemplate(
	`You are an expert software engineer tasked with planning a feature implementation. Provide a concise, step-by-step plan based on the given information and files.

{{objective}}

Project overview: 
{{details}}

Working directory: 
{{workspace}}

Instructions:
1. Analyze the project objective and code files.
2. Determine file relevance (dependencies, modifications needed, or new files required).
3. Assess technologies, approaches, and architecture.
4. Develop a clear, concise implementation plan with:
   - Practical, focused actions
   - Necessary setup or preparation
   - Potential challenges or optimizations
   - Logical order
   - Consistent project-related file paths
5. Consider all provided files in the plan.
6. Do not perform any code changes outside of the objective. Focus on what the core ask is.
7. Create new files if required, following project structure.

File Handling:
- Include relevant files in output.
- Ensure correct file paths and import statements.
- Verify namespaces and code integration.
- Consider default and named exports.

Notes:
- Omit steps for testing, team activities, deployment, or logging unless requested.
- Focus on files relevant to the objective.

Use the 'planner' tool to output a JSON array of implementation steps only. No additional explanations.

Example output:
{
  "plan": [{
    "file": "src/index.ts",
    "steps": ["Import react", "Create root"]
  }]
}

Code Files:

{{files}}
`,
	{
		templateFormat: "mustache",
	}
);

export class CodePlanner {
	codePlanner: ReturnType<typeof plannerPrompt.pipe>;
	vectorQuery = new VectorQuery();

	constructor(
		private readonly chatModel: BaseChatModel,
		private readonly rerankModel: BaseChatModel,
		private readonly workspace: string,
		private readonly codeGraph: CodeGraph,
		private readonly store: Store
	) {
		const model = this.chatModel.withStructuredOutput(planSchema, {
			name: "planner",
		});

		this.codePlanner =
			this.chatModel instanceof ChatOllama
				? plannerPrompt.pipe(this.chatModel)
				: plannerPrompt.pipe(model);
	}

	codePlannerStep = async (
		state: PlanExecuteState
	): Promise<Partial<PlanExecuteState>> => {
		if (state.retryCount === 0) {
			throw new Error("Retry attempts exhausted.");
		}

		const projectDetails = await new ProjectDetailsHandler(
			this.workspace
		).retrieveProjectDetails();
		state.plan = state.plan || { files: [], steps: [] };

		try {
			const objective = buildObjective(state);
			const searchQuery = await this.generateSearchQueries(state);
			const didRetrieve = await this.populateInitialFiles(
				state,
				searchQuery
			);
			let finalDocs = new Map<string, TextDocument>();
			if (didRetrieve) {
				finalDocs = await this.rerankDocuments(state, objective);
			} else {
				state.plan?.files?.map((f) => {
					finalDocs.set(
						f.file,
						TextDocument.create(
							f!.file,
							"plaintext",
							0,
							f!.code || ""
						)
					);
				});
			}
			const { plan } = await this.generatePlan(
				finalDocs,
				projectDetails,
				objective
			);

			const docs = await this.filterRelevantDocs(finalDocs, plan);
			if (docs.length === 0) {
				throw new NoFilesChangedError(
					'No files have been changed. Please ensure you have set "hasChanged" to true for relevant files.'
				);
			}

			return {
				steps: plan,
				projectDetails: projectDetails?.description,
				plan: { files: docs, steps: [] },
			};
		} catch (e) {
			if (e instanceof NoFilesChangedError) {
				loggingProvider.logInfo(
					"Planner was unable to detect which files to modify, restarting"
				);
			}

			throw e;
		}
	};

	private async generateSearchQueries(
		state: PlanExecuteState
	): Promise<string> {
		const lastUserAsk =
			state.followUpInstructions[state.followUpInstructions.length - 1] ||
			state.messages[state.messages.length - 1];
		const result = await this.rerankModel
			.invoke(`You are an AI language model assistant. 
Your task is to generate multiple search queries based on the given question to find relevant information. 
Generate 5 different search queries related to the following question:

Question: ${lastUserAsk.content.toString()}

Search queries:`);

		return result.content.toString();
	}

	private async populateInitialFiles(
		state: PlanExecuteState,
		query: string
	): Promise<boolean> {
		if (!state.plan?.files || state.plan.files.length === 0) {
			const starterDocs =
				await this.vectorQuery.retrieveDocumentsWithRelatedCodeFiles(
					query,
					this.codeGraph,
					this.store,
					this.workspace,
					15
				);

			if (!state.plan) {
				state.plan = {
					files: [],
					steps: [],
				};
			}

			state.plan.files = Array.from(starterDocs.entries()).map(
				([file, doc]) => ({
					file,
					code: doc.getText(),
				})
			);

			return true;
		}

		return false;
	}

	private async rerankDocuments(
		state: PlanExecuteState,
		objective: string
	): Promise<Map<string, TextDocument>> {
		try {
			const rerankResults = await this.rerankModel.invoke(
				`You are a reranking assistant. 
Your task is to evaluate and rank a set of search results based on their relevance to a given query. 
Please consider factors such as topical relevance, information quality, and how well each result addresses the user's likely intent.

Query: ${objective}

Results to rank:
${state.plan?.files?.map((f, index) => {
	return `${index + 1}. ${f.file}\n${f.code}\n\n-----FILE-----\n\n`;
})}

Please analyze these results and provide a ranked list from most relevant to least relevant. For each result, only return the new ranking index. Your response should be in this format:

Ranked results:
[Number from original results]
[Number from original results]
        `
			);
			return this.parseRerankResults(
				rerankResults.content.toString(),
				state
			);
		} catch (e) {
			console.error("Failed to rerank", e);
			return new Map(
				state.plan?.files?.map((file) => [
					file.file,
					TextDocument.create(
						file.file,
						"plaintext",
						0,
						file.code || ""
					),
				])
			);
		}
	}

	private parseRerankResults(
		rerankResults: string,
		state: Partial<PlanExecuteState>,
		maxDocs = 5
	) {
		const rerankedResults = rerankResults
			.split("\n")
			.filter((line) => line.trim() !== "" && !isNaN(Number(line.trim())))
			.map((line) => parseInt(line.trim()));

		const rerankedDocs = new Map<string, TextDocument>();

		rerankedResults.slice(0, maxDocs).forEach((result, newIndex) => {
			if (result - 1 >= (state.plan?.files?.length || 0)) {
				return;
			}

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

		return rerankedDocs;
	}

	private buildFilesPrompt(files: Map<string, TextDocument>) {
		return Array.from(files.entries())
			.map(([file, doc]) => `File:\n${file}\n\nCode:\n${doc.getText()}`)
			.join(`\n\n${FILE_SEPARATOR}\n\n`);
	}

	private async generatePlan(
		finalDocs: Map<string, TextDocument>,
		projectDetails: any,
		objective: string
	): Promise<PlannerSchema> {
		const filesPrompt = this.buildFilesPrompt(finalDocs);
		const plan = await this.codePlanner.invoke({
			details: projectDetails?.description || "Not available.",
			files: `${FILE_SEPARATOR}\n\n${filesPrompt}`,
			objective,
			workspace: this.workspace,
		});

		return this.chatModel instanceof ChatOllama
			? JSON.parse((plan as AIMessage).content.toString())
			: (plan as PlannerSchema);
	}

	private async filterRelevantDocs(
		finalDocs: Map<string, TextDocument>,
		plan: PlannerSchema["plan"]
	): Promise<{ file: string; code: string }[]> {
		const result: { file: string; code: string; steps?: string[] }[] = [];

		for (const f of plan) {
			const filePath = path.resolve(this.workspace, f.file);
			const fileUri = filePathToUri(filePath);

			let doc = finalDocs.get(filePath);
			try {
				if (!doc && fs.existsSync(filePath)) {
					doc = TextDocument.create(
						fileUri,
						"plaintext",
						0,
						await fs.promises.readFile(filePath, "utf8")
					);
				}
			} catch (e) {}

			result.push({
				file: f.file,
				code: doc?.getText() || "//This is a new file, fill in.",
				steps: f.steps,
			});
		}

		return result;
	}
}
