import { z } from "zod";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { VectorQuery } from "../../server/query";
import { CodeGraph } from "../../server/files/graph";
import { Store } from "../../store/vector";
import { ProjectDetailsHandler } from "../../server/project-details";
import { buildObjective } from "../utils";
import { PlanExecuteState } from "../types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ChatOllama } from "@langchain/ollama";
import {
	AIMessage,
	HumanMessage,
	MessageContentImageUrl,
	MessageContentText,
} from "@langchain/core/messages";
import { FILE_SEPARATOR } from "./common";
import { NoFilesChangedError, NoFilesFoundError } from "../errors";
import { loggingProvider } from "../../server/loggingProvider";
import path from "node:path";
import fs from "node:fs";
import { filePathToUri } from "../../server/files/utils";
import { ComposerRequest } from "@shared/types/Composer";

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

const plannerPrompt = `As a senior software engineer, create a focused implementation plan for the following feature:
{{objective}}

Project context:
{{details}}

Working directory:
{{workspace}}

Guidelines:

1. Project Analysis Phase:
   - Map the existing file structure and architecture
   - Identify core technologies and frameworks in use
   - Document current naming conventions and patterns
   - List available shared components, utilities, and services
   - Note relevant configuration files and their purposes

2. File Planning Phase:
   A. Modifications to Existing Files:
      INCLUDE ONLY files that:
      - Require definitive code changes
      - Need new imports or exports
      - Require structural modifications
      - Need new function/component additions
      - Require state/prop changes
      DO NOT INCLUDE files that:
      - Only need verification
      - Might need changes
      - Require review only
      - Are tangentially related
      - Don't require actual code changes

   B. New File Requirements:
      - Define new files with clear purposes
      - Specify their locations within project structure
      - Describe relationships with existing files
      - Detail required imports and exports
      - Explain how they integrate with existing architecture
	  - Only create new files if it is absolutely necessary, co-locate changes in existing files if there is a low probability it is shared code

   C. Integration Analysis:
      - Map direct dependencies only
      - Document concrete integration points
      - Specify definitive configuration changes
      - List required routing updates
      - Include only files directly involved in the feature

3. Implementation Strategy:
   - Provide specific, actionable steps
   - Include only confirmed dependency requirements
   - List only necessary build/config changes
   - Define clear integration points
   - Identify only direct dependencies

4. Technical Considerations:
   - Framework-specific requirements
   - Type system implications
   - State management impact
   - Performance considerations
   - Security implications
   - Browser/device compatibility needs

5. Risk Assessment:
   - Focus on concrete implementation risks
   - Include only relevant dependency conflicts
   - List specific compatibility concerns
   - Highlight direct performance impacts
   - Document security considerations

Constraints:
- Include only files requiring actual modifications
- List only confirmed changes, not potential ones
- Avoid speculative file modifications
- Focus on direct dependencies only
- Include only files essential to the feature
- Maintain clear separation of concerns

Notes:
- Exclude testing, deployment, and logging unless specified
- If required functionality is missing, include it in the plan
- This is a planning phase only, no code implementation
- All file paths should be relative to the working directory
- Include only confirmed version requirements for new dependencies

Use the 'planner' tool to output a JSON array of implementation steps only. No additional explanations.

Example output:
{
  "plan": [{
    "file": "file path relative to the working directory",
    "steps": ["Import react", "Create root"]
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
						f.path,
						TextDocument.create(
							f!.path,
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
				objective,
				state.image
			);

			const docs = await this.filterRelevantDocs(finalDocs, plan);
			if (docs.length === 0) {
				throw new NoFilesChangedError("No files have been changed.");
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
		if (Array.isArray(state.plan?.files) && state.plan.files.length > 0) {
			return false;
		}
	
		const starterDocs = await this.vectorQuery.retrieveDocumentsWithRelatedCodeFiles(
			query,
			this.codeGraph,
			this.store,
			this.workspace,
			15
		);
	
		state.plan = state.plan || { files: [], steps: [] };
		
		state.plan.files = Array.from(starterDocs.entries()).map(
			([file, doc]) => ({
				path: file,
				code: doc.getText(),
			})
		);
	
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
	): Promise<{ path: string; code: string }[]> {
		const result: { path: string; code: string; steps?: string[] }[] = [];

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
				path: f.file,
				code: doc?.getText() || "//This is a new file, fill in.",
				steps: f.steps,
			});
		}

		return result;
	}
}
