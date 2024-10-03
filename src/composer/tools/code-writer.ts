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
	files: z
		.array(
			z.object({
				file: z.string().describe("The full file path"),
				markdown: z
					.string()
					.describe(
						"A markdown formatted code block with the code you've written or modified. Ensure this is always markdown formatted with the proper language set."
					),
				changes: z
					.array(z.string())
					.describe("A list of changes made to the file")
					.optional(),
				hasChanged: z
					.boolean()
					.describe(
						"Whether or not the file has been changed. If false, the file will be skipped"
					)
					.optional(),
			})
		)
		.describe("An array of files you have modified or created"),
});

const ollamaWriterPrompt = `You are an expert software engineer tasked with implementing project enhancements based on a user's objective. 
Your role is to provide a comprehensive solution that includes both manual steps and code changes. 
Approach this task methodically, following these guidelines:

Output Structure:
1. Steps: A clear, concise guide for any additional steps the user needs to take to implement the objective - excluding file changes.
2. Files: Modified or created code files necessary to achieve the objective.

Instructions:
- Analyze the project details to get a sense of the technology being used.
- Analyze the given files for relevance to the objective.
- Modify only relevant files; if a file is not relevant, omit it from the "files" array in your response.
- If no manual steps are required for the file you are working with, just return an empty array for "steps".
- Use consistent and project-related file paths, if files are provided use those as a reference. This is critical.
- If you modify a file's code or create a new file, generate a list of 'changes' made as a summary to the user.
- Not all files provided need to be modified, foocus on the objective and the relevant files.
- Ensure you output using the correct JSON schema provided, this is critial.
- All code files must be formatted using GitHub-flavored markdown.

Step Writing Guidelines:

1. User-Centric Focus:
   - Provide guidance on implementing changes not covered in the code modifications.
   - Present steps as "what's left to do" or actions the user needs to take independently.
   - Do not include setting up your test environment, reviewing code, or other developer tasks. The user will handle these.

2. File Specificity:
   - When a step involves a file you've created or modified, explicitly mention the file name.

3. Command Categorization:
   - For steps requiring terminal commands, provide the exact command in the "command" field.

4. Step Content:
   - Offer clear, concise directions for manual tasks.
   - Ensure no overlap between steps and file changes.
   - Do not include any steps related to files you are modifying or creating below.

5. Exclusions:
   - Omit steps for testing or code verification unless explicitly required.

6. Conciseness:
   - Eliminate any redundant or unnecessary steps.

7. Clarity:
   - Ensure each step is clear, specific, and actionable.
   - Use simple language and avoid technical jargon when possible.

Code Writing Guidelines:

1. Markdown Usage:
   - Use GitHub-flavored markdown for ALL code output, without exception.
   - Determine the correct language for markdown code blocks based on file name and extension.

2. Code Quality and Style:
   - Write clean, efficient, and well-documented code that matches the existing project style.
   - Maintain consistent indentation, naming conventions, and code organization.
   - Use meaningful variable and function names that clearly convey their purpose.
   - Add comments for complex logic or non-obvious implementations.
   - Observe existing patterns and libraries being used and leverage those where possible.

3. Project Consistency:
   - Adhere strictly to the existing project structure and architecture.
   - Use the same coding patterns, design principles, and architectural decisions as seen in existing files.
   - Maintain consistency in error handling, logging, and state management approaches.

4. Dependencies and Imports:
   - Leverage existing dependencies; avoid introducing new ones unless absolutely necessary.
   - Ensure all import statements are correct and use relative paths when appropriate.
   - Pay special attention to named exports vs. default exports in import statements.
   - For new files, include all necessary imports, considering the project's module structure.

5. File Paths and Naming:
   - Use consistent and project-related file paths for new files.
   - Ensure file names follow the project's naming conventions (e.g., camelCase, kebab-case).
   - When referencing other files (in imports or elsewhere), double-check the file paths for accuracy.

6. Type Safety:
   - If the project uses TypeScript or has type annotations, ensure all new code is properly typed.
   - Infer types from existing code where possible to maintain consistency.
   - For JavaScript projects, consider adding JSDoc comments for better type hinting.

7. Completeness and Functionality:
   - Provide complete, functional code without placeholders or TODOs.
   - Implement full error handling and edge case management.
   - Ensure any new functions or methods have appropriate return types and handle all possible inputs.

8. Performance Considerations:
   - Write code with performance in mind, especially for potentially resource-intensive operations.
   - Use appropriate data structures and algorithms for efficient processing.

9. Security:
    - Be mindful of security implications, especially when handling user input or sensitive data.
    - Follow security best practices relevant to the project's domain and technology stack.

10. Backwards Compatibility:
    - Ensure changes don't break existing functionality unless explicitly required by the objective.
    - If breaking changes are necessary, clearly document them in the 'Changes' section.

11. Code Reusability:
    - Look for opportunities to refactor common functionality into reusable functions or components.
    - Balance code reuse with maintainability and readability.

12. Documentation:
    - Update or create documentation for new or modified functionality.
    - Include clear, concise comments explaining the purpose and behavior of complex code sections.

13. Integration:
    - When reviewing multiple files, consider how they may be connected and integrated together.
    - Ensure new code integrates seamlessly with existing components and systems.

{RULE_PACK}

File Handling:
- For each file:
  - If relevant to the objective: modify as needed, if you need to create a file, create one.
  - If not relevant, omit it from your response.
  - Any changes made to the file should be listed in the 'changes' field in a short and concise format (array of strings).
  - Output markdown using the 'markdown' field, ensuring GitHub-flavored markdown format with the correct language for the code block.
  - YOU MUST PRODUCE CODE WRAPPED IN GITHUB-FLAVORED MARKDOWN!

------

Project Details:

{{details}}

------

{{steps}}

{{review}}

------

{{modified}}

{{files}}

------

Output Format:

You must ALWAYS Output in JSON format using the following template:
{
  "steps": [
    {
      "description": "string",
      "command": "string (optional)"
    }
  ],
  "files": [
    {
      "file": "string",
      "markdown": "string",
      "changes": ["string"]
    }
  ]
}`;

const baseWriterPrompt = `Analyze this text and output JSON.
Analyze and implement project enhancements for a single file based on the user's objective.
You are an expert software engineer tasked with providing a comprehensive solution that includes both manual steps and code changes.
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
1. Focus on user-centric, actionable steps not covered in code modifications - these would be manual steps the user still needs to take.
2. Explicitly mention file names when relevant.
3. Categorize terminal commands in the "command" field.
4. Ensure clarity, conciseness, and no overlap with file changes, for instance if you imported a file in a code change the user does not need to take manual action.
5. Omit steps for testing or code verification unless explicitly required.
6. Do not include new files created in the steps, these are created for the user automatically.

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
- Omit irrelevant or unchanged files.
- Omit code verification or extraneous changes.
- Use GitHub-flavored markdown for code blocks.
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

{{modified}}

{{otherfiles}}

------

File in scope:

{{files}}

------

Implement required changes for the file in scope to meet the objective. 
Use GitHub-flavored markdown for code output and follow the provided JSON schema. 
Ensure the "files" property is an array of objects, not a string. 
PRODUCE VALID JSON TO AVOID PENALTIES.`;

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

		const files: CodeWriterSchema["files"] = [];
		const steps: CodeWriterSchema["steps"] = [];
		for (const { file, code } of state.plan?.files || [
			{
				file: "BLANK",
				changes: [],
				code: "",
			},
		]) {
			const output = (await codeWriter.invoke({
				details: state.projectDetails || "Not available.",
				objective,
				steps: planningSteps,
				review: reviewComments,
				modified:
					files.length === 0
						? ""
						: `Context: Previously Modified/Created Files

The following list contains files already processed, along with their changes. 
Use this information as context for subsequent file processing. Do not modify these files again.
Note: Consider dependencies between files.

${files.map((f) => `File:\n${f.file}\n\nChanges:\n${f.changes?.join("\n")}`)}

------`,
				otherfiles:
					state.plan?.files
						?.filter((f) => f.file !== file)
						?.map(
							(f) => `${FILE_SEPARATOR}
          
File:
${f.file}

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

			const filesChanged =
				result.files?.filter(
					(f) => f.changes && f.changes?.length > 0
				) || [];

			files.push(
				...(filesChanged || [
					{ file, changes: ["None were required."] },
				])
			);
			steps.push(...result.steps);
		}

		if (files.length === 0) {
			throw new NoFilesChangedError(
				'No files have been changed. Please ensure you have set "hasChanged" to true for relevant files.'
			);
		}

		return {
			plan: {
				steps: steps,
				files: files.map((f) => {
					return {
						file: f.file,
						code: f.markdown,
						changes: f.changes,
						hasChanged: f.hasChanged,
					};
				}),
			},
		} satisfies Partial<PlanExecuteState>;
	};
}
