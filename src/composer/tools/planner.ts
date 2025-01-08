import { z } from "zod";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { VectorQuery } from "../../server/query";
import { CodeGraph } from "../../server/files/graph";
import { Store } from "../../store/vector";
import { ProjectDetailsHandler } from "../../server/project-details";
import { buildObjective } from "../utils";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ChatOllama } from "@langchain/ollama";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import {
	AIMessage,
	HumanMessage,
	MessageContentImageUrl,
	MessageContentText,
} from "@langchain/core/messages";
import { FILE_SEPARATOR } from "./common";
import { NoFilesChangedError } from "../errors";
import { loggingProvider } from "../../server/loggingProvider";
import path from "node:path";
import fs from "node:fs";
import { filePathToUri } from "../../server/files/utils";
import { ComposerRequest } from "@shared/types/Composer";
import { PlanExecuteState } from "../types";
import { FileMetadata } from "@shared/types/Message";

export type PlannerSchema = z.infer<typeof planSchema>;

const planSchema = z.object({
	summary: z.string().describe("The summary of the implementation plan"),
	plan: z.array(
		z.object({
			file: z.string().describe("The file to create or modify"),
			steps: z
				.array(z.string())
				.describe("A list of steps to follow specific to the file."),
		})
	),
});

const plannerPrompt = `As a senior software engineer, create a focused implementation plan for the following feature:
{{objective}}

Project context:
{{details}}

Working directory:
{{workspace}}

Analysis Requirements:

1. Project Structure
   - Map architecture and file structure
   - Identify core tech stack
   - Document patterns and conventions
   - List shared resources and configs

2. Required Changes
   A. Existing Files (only include if requiring):
      - Code modifications
      - Import/export changes
      - Structural updates
      - New functions/components
      - State/prop modifications

   B. New Files (create only if necessary):
      - Purpose and location
      - Dependencies and integrations
      - Required imports/exports
      - Integration points
      - Prefer co-location with existing code

   C. Integration Points
      - Direct dependencies
      - Configuration changes
      - Routing updates
      - Integration touchpoints
	  - Fits in with the overall styling and theme of the application

3. Implementation Plan
   - Actionable steps
   - Required dependencies (latest versions)
   - Build/config changes
   - Integration points

4. Technical Scope
   - Framework requirements
   - Type system impact
   - State management
   - Performance
   - Security
   - Compatibility

5. Risk Factors
   - Implementation risks
   - Dependency conflicts
   - Performance impact
   - Security concerns

Constraints:
- Include only necessary file modifications, do not make changes that are not part of the active objective.
- Focus on direct dependencies
- Maintain separation of concerns
- Exclude testing/deployment unless specified
- All paths relative to working directory
- Order files sequentially based on implementation dependencies

Note:
- You may be provided files not related to the objective.
- Use the objective to determine which files are related to the objective.
- Do not make extraneous changes.
- Do not modify files that are not related to the objective.
- Focus on the core objective and write your best code.

Use the 'planner' tool to output a JSON array of implementation steps only. No additional explanations.

Output Format:
{
  "plan": [{
    "file": "relative/path/to/file",
    "steps": ["implementation steps"]
  }]
}

Code Files:

{{files}}`;

export class CodePlanner {
	codePlanner: any;
	vectorQuery = new VectorQuery();

	constructor(
		private readonly chatModel: BaseChatModel,
		private readonly rerankModel: BaseChatModel,
		private readonly workspace: string,
		private readonly codeGraph: CodeGraph,
		private readonly store: Store
	) {
		this.codePlanner =
			this.chatModel instanceof ChatOllama
				? this.chatModel
				: this.chatModel.withStructuredOutput(planSchema, {
					name: "planner",
				});
	}

	codePlannerStep = async (
		state: PlanExecuteState
	): Promise<Partial<PlanExecuteState>> => {
		if (state.retryCount === 0) {
			throw new Error("Retry attempts exhausted.");
		}

		const projectDetailsHandler = new ProjectDetailsHandler(
			this.workspace
		);
		try {
			const projectDetails = await projectDetailsHandler.retrieveProjectDetails();
			state.plan = state.plan || { files: [] };

			const objective = buildObjective(state);
			const didRetrieve = await this.populateInitialFiles(
				state
			);
			let finalDocs = new Map<string, TextDocument>();
			// Temporary disable - limiting the documents to 5 on rerank can hide valuable documents.
			// if (didRetrieve) {
			// 	finalDocs = await this.rerankDocuments(state, objective);
			// } else {
			state.plan?.files?.map((f) => {
				finalDocs.set(
					f.path,
					TextDocument.create(
						f!.path,
						"plaintext",
						0,
						f!.code || ""
					)
				);
			});
			//}
			const response = await this.generatePlan(
				finalDocs,
				projectDetails,
				objective,
				state.image
			);

			const docs = await this.filterRelevantDocs(finalDocs, response.plan);
			if (docs.length === 0) {
				throw new NoFilesChangedError("No files have been changed.");
			}

			const plan: PlanExecuteState["plan"] = {
				summary: response.summary,
				files: docs
			};

			await dispatchCustomEvent("composer-planner", {
				plan
			} satisfies Partial<PlanExecuteState>);

			return {
				projectDetails: projectDetails?.description,
				plan
			} satisfies Partial<PlanExecuteState>;
		} catch (e) {
			if (e instanceof NoFilesChangedError) {
				loggingProvider.logInfo(
					"Planner was unable to detect which files to modify, restarting"
				);
			}

			throw e;
		}
	};

	private async populateInitialFiles(state: PlanExecuteState): Promise<boolean> {
		const seenFiles = new Set<string>();
		const allDocs = new Map<string, TextDocument>();
		const MAX_ITERATIONS = 3;
		const DOCS_PER_ITERATION = 15;
		const previousQueries = new Set<string>();

		const objective = (state.followUpInstructions[state.followUpInstructions.length - 1] ||
			state.messages[state.messages.length - 1]).content.toString();

		// First, analyze existing files if present
		if (state.plan?.files?.length) {
			for (const file of state.plan.files) {
				seenFiles.add(file.path);
				// Convert existing files to TextDocument format
				const doc = TextDocument.create(
					file.path,
					file.language || 'plaintext',
					1,
					file.code || ''
				);
				allDocs.set(file.path, doc);
			}

			// Check if existing files are sufficient
			const existingFilesSummary = Array.from(seenFiles).join('\n');
			const initialCheckResponse = await this.rerankModel.invoke(`
	Based on the objective, analyze if the existing files are sufficient.
	
	Objective: ${objective}
	
	Existing files:
	${existingFilesSummary}
	
	Rules:
	1. If all necessary files are present, respond with "COMPLETE"
	2. If more files are needed, respond with "CONTINUE"
	
	Response (either "COMPLETE" or "CONTINUE"):
			`);

			if (initialCheckResponse.content.toString().trim() === "COMPLETE") {
				state.plan.files = Array.from(allDocs.entries()).map(([file, doc]) => ({
					path: file,
					code: doc.getText(),
				}));
				return true;
			}
		}

		// If we need more files, proceed with search
		let currentQuery = objective;
		previousQueries.add(currentQuery);

		for (let i = 0; i < MAX_ITERATIONS; i++) {
			const docs = await this.vectorQuery.retrieveDocumentsWithRelatedCodeFiles(
				currentQuery,
				this.codeGraph,
				this.store,
				this.workspace,
				DOCS_PER_ITERATION
			);

			for (const [path, doc] of docs.entries()) {
				if (!seenFiles.has(path)) {
					seenFiles.add(path);
					allDocs.set(path, doc);
				}
			}

			const foundFilesSummary = Array.from(docs.keys()).join('\n');
			const nextQueryResponse = await this.rerankModel.invoke(`
	Based on the objective and files found so far, generate a new unique search query that focuses on different aspects.
	
	Objective: ${objective}
	
	Files found so far:
	${foundFilesSummary}
	
	Previous queries used:
	${Array.from(previousQueries).join('\n')}
	
	Rules:
	1. If all necessary files are found, respond with "COMPLETE"
	2. If more files are needed, provide a specific search query that:
		- Must be different from all previous queries
		- Focuses on unexplored aspects of the objective
		- Is specific and targeted (e.g. "authentication middleware", "database models")
		- Request files that help give better context about external libraries
	3. Focus on finding related files that would be needed for implementation
	4. Do not return any text besides "COMPLETE" or the new search query
	
	Response (either "COMPLETE" or new search query):
			`);

			const nextQuery = nextQueryResponse.content.toString().trim();

			if (nextQuery === "COMPLETE" || allDocs.size >= 15) {
				break;
			}

			if (previousQueries.has(nextQuery)) {
				continue;
			}

			currentQuery = nextQuery;
			previousQueries.add(currentQuery);
		}

		state.plan = state.plan || { files: [] };
		state.plan.files = Array.from(allDocs.entries()).map(([file, doc]) => ({
			path: file,
			code: doc.getText(),
		}));

		return true;
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
					return `${index + 1}. ${f.path}\n${f.code}\n\n-----FILE-----\n\n`;
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
					file.path,
					TextDocument.create(
						file.path,
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
				originalFile!.path,
				TextDocument.create(
					originalFile!.path,
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
		objective: string,
		image?: ComposerRequest["image"]
	): Promise<PlannerSchema> {
		const filesPrompt = this.buildFilesPrompt(finalDocs);
		const msgContent: Array<MessageContentText | MessageContentImageUrl> = [
			{
				type: "text",
				text: plannerPrompt
					.replace(
						"{{details}}",
						projectDetails?.description || "Not available."
					)
					.replace("{{files}}", `${FILE_SEPARATOR}\n\n${filesPrompt}`)
					.replace("{{objective}}", objective)
					.replace("{{workspace}}", this.workspace),
			},
		];
		if (image) {
			msgContent.push({
				type: "image_url",
				image_url: {
					url: image?.data,
				},
			});
		}
		const plan = await this.codePlanner.invoke([
			new HumanMessage({
				content: msgContent,
			}),
		]);

		return this.chatModel instanceof ChatOllama
			? JSON.parse((plan as AIMessage).content.toString())
			: (plan as PlannerSchema);
	}

	private async filterRelevantDocs(
		finalDocs: Map<string, TextDocument>,
		plan: PlannerSchema["plan"]
	): Promise<FileMetadata[]> {
		const result: FileMetadata[] = [];

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
			} catch { }

			result.push({
				path: f.file,
				code: doc?.getText() || "//This is a new file, fill in.",
				plan: f.steps,
			} satisfies FileMetadata);
		}

		return result;
	}
}
