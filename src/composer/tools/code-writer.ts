import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlanExecuteState } from "../types";
import { formatMessages } from "../utils";
import { ProjectDetailsHandler } from "../../server/project-details";
import { VectorQuery } from "../../server/query";
import { CodeGraph } from "../../server/files/graph";
import { Store } from "../../store/vector";
import { TextDocument } from "vscode-languageserver-textdocument";

export type CodeWriterSchema = z.infer<typeof codeWriterSchema>;

export const codeWriterSchema = z.object({
	steps: z.array(
		z.object({
			description: z.string().describe("The step to take"),
			command: z
				.string()
				.optional()
				.describe(
					"If the step is a command, this is the command to run"
				),
		})
	),
	files: z.array(
		z.object({
			file: z.string(),
			markdown: z
				.string()
				.describe(
					"A markdown formatted code block with the code you've written or modified"
				),
			changes: z
				.array(z.string())
				.describe("A list of changes made to the file"),
			hasChanged: z
				.boolean()
				.describe(
					"Whether or not the file has been changed. If false, the file will be skipped"
				),
		})
	),
});

const planSchema = zodToJsonSchema(codeWriterSchema);
const codeWriterFunction = {
	name: "code-writer",
	description: "This tool is used to write or update code and documentation.",
	parameters: planSchema,
};

export const codeWriterTool = {
	type: "function",
	function: codeWriterFunction,
};

const writerPrompt = ChatPromptTemplate.fromTemplate(
	`You are  an expert software engineer tasked with implementing project enhancements based on a user's objective. Approach this task methodically, following these guidelines:

Output:
1. Steps: Provide a clear and concise guide on any manual steps the user should take (excluding file changes you are making).
2. Files: Present modified or created code files necessary to achieve the goal.

General Instructions:
- Analyze the given files for relevance to the objective.
- Modify only relevant files; leave unrelated files unchanged - set 'hasChanged' to false.
- When creating new files, ensure consistent and project-related file paths.
- List all changes made to modified or created files.

------

Step Writing Guidelines:

1. Focus on user-centric guidance:
   - Steps should guide the user on implementing changes not already made in the code.
   - Present steps as "what's left to do" or actions the user needs to take independently.
2. File specificity:
   - When a step involves a file you've created or modified, explicitly mention the file name.
3. Step categorization:
   - If a step involves the user executing a command in their terminal, provide the command in the "command" field.
4. Step content:
   - Provide clear, concise directions for manual tasks.
   - Make sure there is no overlap between steps and file changes.
5. Exclusions:
   - Omit steps for testing or code verification.
6. Conciseness:
   - Eliminate any redundant or unnecessary steps.
7. Clarity:
   - Ensure each step is clear, specific, and actionable
   - Use simple language and avoid technical jargon when possible

------

Code Writing Guidelines:

1. Use GitHub-flavored markdown for all code output.
2. Write clean, efficient, and well-documented code that matches existing style.
3. Include appropriate tests for new functionality.
4. Leverage existing dependencies and adhere to project structure.
5. Provide complete, functional code without placeholders or TODOs.
6. Ensure correct import statements and file paths.
7. Implement only changes directly related to requirements.
8. Follow existing patterns for state management, error handling, and code structure.
9. Determine language for markdown code blocks based on file name and extension.

For each file:
- If relevant to the objective: Modify as needed and set 'hasChanged' to true.
- If not relevant: Set 'hasChanged' to false and skip the file.
- Output markdown using the 'markdown' field using the GitHub-flavored markdown format.

Project Details:

{details}

------

Objective:

{objective}

------

Files:

{files}

------

Proceed with implementing the required changes to meet the given objective.
You must absolutely use GitHub-flavored markdown for code markdown output, you will be penalized for not doing so.`
);

export class CodeWriter {
	model: ReturnType<typeof BaseChatModel.prototype.withStructuredOutput>;
	codeWriter: ReturnType<typeof writerPrompt.pipe>;
	vectorQuery = new VectorQuery();

	constructor(
		private readonly chatModel: BaseChatModel,
		private readonly workspace: string,
		private readonly codeGraph: CodeGraph,
		private readonly store: Store
	) {
		//@ts-expect-error
		this.model = this.chatModel.withStructuredOutput(codeWriterSchema, {
			name: "code-writer",
		});
		this.codeWriter = writerPrompt.pipe(this.model);
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

	codeWriterStep = async (
		state: PlanExecuteState
	): Promise<Partial<PlanExecuteState>> => {
		const projectDetails = new ProjectDetailsHandler(
			this.workspace,
			undefined
		);
		const details = await projectDetails.retrieveProjectDetails();
		const files: CodeWriterSchema["files"] = [];

		const context =
			state.followUpInstructions.length > 0
				? formatMessages(state.followUpInstructions)
				: formatMessages(state.messages);

		let starterDocs = new Map();

		if (!state.plan?.files || state.plan.files.length === 0) {
			starterDocs =
				await this.vectorQuery.retrieveDocumentsWithRelatedCodeFiles(
					`${context}\n\n${state.plannerQuestions?.join("\n") || ""}`,
					this.codeGraph,
					this.store,
					this.workspace,
					15
				);
		}

		state.plan?.files?.forEach((file) => {
			if (!starterDocs.has(file.file)) {
				starterDocs.set(
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

		const prompt = Array.from(starterDocs.entries())
			.map(([file, doc]) => {
				return `File:
${file}

Code:
${doc.getText()}`;
			})
			.join("\n\n");

		const plan = (await this.codeWriter.invoke({
			details: details?.description || "Not available.",
			objective: this.buildObjective(state),
			files: prompt,
		})) as CodeWriterSchema;

		const filesChanged = plan.files?.filter((f) => f.hasChanged) || [];
		files.push(...filesChanged);

		return {
			plan: {
				steps: plan.steps,
				files: files.map((f) => {
					return {
						file: f.file,
						code: f.markdown,
						changes: f.changes,
						hasChanged: f.hasChanged,
					};
				}),
			},
		};
	};
}
