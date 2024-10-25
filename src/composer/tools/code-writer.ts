import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlanExecuteState } from "../types";
import { buildObjective, loadWingmanRules } from "../utils";
import { NoFilesChangedError } from "../errors";
import { ChatOllama } from "@langchain/ollama";
import { AIMessage } from "@langchain/core/messages";
import { FILE_SEPARATOR } from "./common";

export type CodeWriterSchema = z.infer<typeof codeWriterSchema>;

export const codeWriterSchema = z.object({
	steps: z
		.array(
			z.object({
				description: z.string().describe("The step to take"),
				command: z
					.string()
					.optional()
					.describe(
						"If the step is a command, this is the command to run"
					),
			})
		)
		.describe(
			"An array of manual steps to follow to complete the task, leave empty if there are no manual steps."
		),
	file: z
		.object({
			path: z.string().describe("The full file path"),
			markdown: z
				.string()
				.describe(
					"A markdown formatted code block with the code you've written or modified. Ensure this is always markdown formatted with the proper language set."
				),
			changes: z
				.array(z.string())
				.describe("A list of changes made to the file")
				.optional(),
		})
		.describe("The file in scope that you have modified or created"),
});

const ollamaWriterPrompt = `Analyze this text and output JSON.
You are an expert software engineer tasked with providing a comprehensive solution that includes both manual steps and code changes.
Implement project enhancements for a single file based on the user's objective.
Focus solely on the file in scope, while considering the context of other files for integration purposes.

Output Structure:
1. Steps: Concise guide for manual implementation steps, excluding file changes.
2. Files: Modified or created code for the file in scope.

Key Instructions:
1. Process only the file in scope, do not modify a provided file that is not in scope.
2. Use other files as context for integration (import paths, exports, names, etc.).
3. Omit files requiring no changes or just verification.
4. Output only if changes are made or a new file is created.
5. Always use GitHub-flavored markdown for code output.
6. Provide full file paths in the response.
7. Do not perform extraneous changes to files, dig deep and focus on the integrate between the files given.
7. Ensure output adheres to the provided JSON schema.

Step Writing Guidelines:
1. Focus on user-centric, actionable steps not covered in code modifications - these would be manual steps the user still needs to take such as installing dependencies.
2. Explicitly mention file names when relevant.
3. Categorize terminal commands in the "command" field - group descriptions for the command in a single step.
4. Ensure clarity, conciseness, and no overlap with file changes, for instance if you imported a file in a code change the user does not need to take manual action.
5. Omit steps for testing or code verification unless explicitly required.
6. Do not include new files created in the steps, these are created for the user automatically.
7. If there are no manual steps, simply return an empty array.
8. Do not return steps such as: "No manual steps are required for this change."

Code Writing Guidelines:
1. Use GitHub-flavored markdown for ALL code output.
2. Match existing project style, structure, and architecture.
3. Maintain consistency in naming, error handling, and state management.
4. Leverage existing dependencies and ensure correct imports.
5. Provide complete, functional code without placeholders.
6. Consider performance, security, and backwards compatibility.
7. Update or create documentation as needed.
8. Ensure seamless integration with existing components.
9. Maintain existing functionality in files, do not cause regression bugs. This is critical.

{RULE_PACK}

File Handling:
- Process one file at a time.
- Modify or create files relevant to the objective.
- Maintain existing functionality in files, do not cause regression bugs. This is critical.
- Use any provided file paths as a reference for any new files.
- Omit irrelevant or unchanged files.
- Omit code verification or extraneous changes.
- Use GitHub-flavored markdown for files, the code must be wrapped in markdown. Do not mess this up.
- Provide full, functional code responses.
- Always include the full file path.
- List changes performed on files, if no changes are performed, omit the file.

------

{{details}}

------

{{objective}}

{{steps}}

------

{{review}}

------

{{newsteps}}

{{modified}}

{{otherfiles}}

------

File in scope:

{{files}}

------

Implement required changes for the file in scope to meet the objective. 
Use GitHub-flavored markdown for code output and follow the provided JSON schema. 
Ensure the "file" property is an object, not a string. 

You must ALWAYS Output in JSON format using the following template:
{
  "steps": [
    {
      "description": "string",
      "command": "string (optional)"
    }
  ],
  "file": {
    "path": "string",
    "markdown": "string",
    "changes": ["string"]
  }
}`;

const baseWriterPrompt = `Analyze this text and output JSON.
You are an expert software engineer tasked with providing a comprehensive solution that includes both manual steps and code changes.
Implement project enhancements for a single file based on the user's objective.
Focus solely on the file in scope, while considering the context of other files for integration purposes.

Output Structure:
1. Steps: Concise guide for manual implementation steps, excluding file changes.
2. Files: Modified or created code for the file in scope.

Key Instructions:
1. Process only the file in scope, do not modify a provided file that is not in scope.
2. Use other files as context for integration (import paths, exports, names, etc.).
3. Omit files requiring no changes or just verification.
4. Output only if changes are made or a new file is created.
5. Always use GitHub-flavored markdown for code output.
6. Provide full file paths in the response.
7. Do not perform extraneous changes to files, dig deep and focus on the integrate between the files given.
7. Ensure output adheres to the provided JSON schema.

Step Writing Guidelines:
1. Focus on user-centric, actionable steps not covered in code modifications - these would be manual steps the user still needs to take such as installing dependencies.
2. Explicitly mention file names when relevant.
3. Categorize terminal commands in the "command" field.
4. Ensure clarity, conciseness, and no overlap with file changes, for instance if you imported a file in a code change the user does not need to take manual action.
5. Omit steps for testing or code verification unless explicitly required.
6. Do not include new files created in the steps, these are created for the user automatically.
7. If there are no manual steps, simply return an empty array.
8. Do not return steps such as: "No manual steps are required for this change."

Code Writing Guidelines:
1. Use GitHub-flavored markdown for ALL code output.
2. Match existing project style, structure, and architecture.
3. Maintain consistency in naming, error handling, and state management.
4. Leverage existing dependencies and ensure correct imports.
5. Provide complete, functional code without placeholders.
6. Consider performance, security, and backwards compatibility.
7. Update or create documentation as needed.
8. Ensure seamless integration with existing components.
9. Maintain existing functionality in files, do not cause regression bugs. This is critical.

{RULE_PACK}

File Handling:
- Process one file at a time.
- Modify or create files relevant to the objective.
- Maintain existing functionality in files, do not cause regression bugs. This is critical.
- Use any provided file paths as a reference for any new files.
- Omit irrelevant or unchanged files.
- Omit code verification or extraneous changes.
- Use GitHub-flavored markdown for files, the code must be wrapped in markdown. Do not mess this up.
- Provide full, functional code responses.
- Always include the full file path.
- List changes performed on files, if no changes are performed, omit the file.

------

{{details}}

------

{{objective}}

{{steps}}

------

{{review}}

------

{{newsteps}}

{{modified}}

{{otherfiles}}

------

File in scope:

{{files}}

------

Implement required changes for the file in scope to meet the objective. 
Use GitHub-flavored markdown for code output and follow the provided JSON schema. 
Ensure the "file" property is an object, not a string. 

You must ALWAYS Output in JSON format using the following template:
{
  "steps": [
    {
      "description": "string",
      "command": "string (optional)"
    }
  ],
  "file": {
    "path": "string",
    "markdown": "string",
    "changes": ["string"]
  }
}`;

const buildPrompt = (basePrompt: string, rulePack?: string) => {
	const rulePromptAddition = !rulePack
		? ""
		: `Use the following rules to guide your code writing:
  
${rulePack}`;
	return ChatPromptTemplate.fromTemplate(
		basePrompt.replace("{RULE_PACK}", rulePromptAddition),
		{
			templateFormat: "mustache",
		}
	);
};

export class CodeWriter {
	constructor(
		private readonly chatModel: BaseChatModel,
		private readonly workspace: string
	) {}

	codeWriterStep = async (
		state: PlanExecuteState
	): Promise<Partial<PlanExecuteState>> => {
		const rulePack = loadWingmanRules(this.workspace);
		const objective = buildObjective(state);

		const planningSteps = state.steps
			? `Implementation steps:
- Use these as a guide or starting point.
- Use these to help perform cross file coordination.

Here are the steps per file:

${state.steps
	.map(
		(s) => `File:
  
${s.file}

Steps:
- ${s.steps.join("\n- ")}`
	)
	.join("\n")}`
			: "";

		const reviewComments =
			!state.review?.comments || state.review?.comments?.length === 0
				? ""
				: `Here are comments from a review of your code changes.
Use these comments to refine your code and meet the objective.

${state.review?.comments?.join("\n")}

------`;

		const codeWriter =
			this.chatModel instanceof ChatOllama
				? buildPrompt(ollamaWriterPrompt, rulePack).pipe(this.chatModel)
				: buildPrompt(baseWriterPrompt, rulePack).pipe(
						this.chatModel.withStructuredOutput(codeWriterSchema, {
							name: "code-writer",
						})
				  );

		const files: CodeWriterSchema["file"][] = [];
		const steps: CodeWriterSchema["steps"] = [];
		for (const { path: file, code } of state.plan?.files || [
			{
				path: "BLANK",
				changes: [],
				code: "",
			},
		]) {
			const output = (await codeWriter.invoke({
				details: state.projectDetails || "Not available.",
				objective,
				steps: planningSteps,
				review: reviewComments,
				newsteps:
					steps.length === 0
						? ""
						: `Context: Previously Created Manual Steps
        
The following list contains manual steps already created based on previously modified or created files.
Use this information as context for subsequent step process. Do not suggest these again.

${steps.map((s) => `${s.description}\n${s.command}`).join("\n\n")}

------`,
				modified:
					files.length === 0
						? ""
						: `Context: Previously Modified/Created Files

The following list contains files already processed, along with their changes. 
Use this information as context for subsequent file processing. Do not modify these files again.
Note: Consider dependencies between files.

${files.map((f) => `File:\n${f.path}\n\nChanges:\n${f.changes?.join("\n")}`)}

------`,
				otherfiles:
					state.plan?.files
						?.filter((f) => f.path !== file)
						?.map(
							(f) => `${FILE_SEPARATOR}
          
File:
${f.path}

Code:
${f.code}`
						)
						.join(`\n\n${FILE_SEPARATOR}\n\n`) || "",
				files:
					file === "BLANK"
						? `The user does not currently have any related files, assume this may be a new project and this is your base directory: ${this.workspace}`
						: `File:\n${file}\n\nCode:\n${code}`,
			})) as CodeWriterSchema | AIMessage;

			let result: CodeWriterSchema = output as CodeWriterSchema;
			if (this.chatModel instanceof ChatOllama) {
				const response = (output as AIMessage).content.toString();
				result = JSON.parse(response);
			}

			const fileChanged =
				result.file.changes && result.file.changes.length > 0;

			if (!files.some((f) => f.path === result.file.path)) {
				files.push(
					fileChanged
						? result.file
						: {
								path: result.file.path,
								changes: [
									"None were required, this file was not modified.",
								],
								markdown: result.file.markdown,
						  }
				);
			}

			steps.push(...result.steps);
		}

		if (files.length === 0) {
			throw new NoFilesChangedError("No files have been changed.");
		}

		return {
			plan: {
				steps: steps,
				files: files.map((f) => {
					return {
						path: f.path,
						code: f.markdown,
						changes: f.changes,
					};
				}),
			},
		} satisfies Partial<PlanExecuteState>;
	};
}
