import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlanExecuteState } from "../types";
import { buildObjective, loadWingmanRules } from "../utils";
import { NoFilesChangedError } from "../errors";

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
		.describe("A list of manual steps to follow to complete the task"),
	files: z
		.array(
			z
				.object({
					file: z.string().describe("The file path"),
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
				.describe("A file you've modified or created")
		)
		.describe("A list of files you've modified or created"),
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

const baseWriterPrompt = `You are an expert software engineer tasked with implementing project enhancements based on a user's objective. Your role is to provide a comprehensive solution that includes both manual steps and code changes. Approach this task methodically, following these guidelines:

Output Structure:
1. Steps: A clear, concise guide for manual actions the user must take, not covered by modifications done to files.
2. Files: Modified or created code files necessary to achieve the objective.

General Instructions:
- Analyze the given files and project details for relevance to the objective.
- Modify only relevant files; set 'hasChanged' to false for unrelated files.
- Ensure 'hasChanged' property is included for every file, without exception.
- When creating new files, use consistent and project-related file paths.
- List all changes made to modified or created files.
- Ensure you output using the correct JSON schema provided, this is critial.

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

{RULE_PACK}

File Handling:
- For each file:
  - If relevant to the objective: Modify as needed and set 'hasChanged' to true.
  - If not relevant: Set 'hasChanged' to false and skip the file.
  - ALWAYS include the 'hasChanged' property for each file.
  - Output markdown using the 'markdown' field, ensuring GitHub-flavored markdown format with the correct language for the code block.
  - YOU MUST PRODUCE CODE WRAPPED IN GITHUB-FLAVORED MARKDOWN!

Example Output Structures:

Example 1:
(
  "steps": [
    (
      "description": "Create a new file called 'hello.js'"
    ),
    (
      "description": "Run the JavaScript file",
      "command": "node hello.js"
    )
  ],
  "files": [
    (
      "file": "hello.js",
      "markdown": "\`\`\`javascript\\nconsole.log('Hello, World!');\\n\`\`\`",
      "changes": ["Added console.log statement"],
      "hasChanged": true
    )
  ]
)

Example 2:
(
  "steps": [
    (
      "description": "Update the existing 'index.html' file"
    ),
    (
      "description": "Create a new CSS file 'styles.css'"
    ),
    (
      "description": "Open the HTML file in a browser",
      "command": "open index.html"
    )
  ],
  "files": [
    (
      "file": "index.html",
      "markdown": "\`\`\`html\\n<!DOCTYPE html>\\n<html lang=\\"en\\">\\n<head>\\n  <meta charset=\\"UTF-8\\">\\n  <title>Updated Page</title>\\n  <link rel=\\"stylesheet\\" href=\\"styles.css\\">\\n</head>\\n<body>\\n  <h1>Hello, Updated World!</h1>\\n</body>\\n</html>\\n\`\`\`",
      "changes": ["Updated title", "Added link to styles.css"],
      "hasChanged": true
    ),
    (
      "file": "styles.css",
      "markdown": "\`\`\`css\\nbody (\\n  font-family: Arial, sans-serif;\\n  background-color: #f0f0f0;\\n)\\n\\nh1 (\\n  color: #333;\\n)\\n\`\`\`",
      "changes": ["Created new CSS file"],
      "hasChanged": true
    )
  ]
)

Note: In the examples above, parentheses () are used instead of curly braces. When you create your output, replace () with curly braces to form valid JSON.

Use these examples as a reference for the structure and format of your output.

------

Project Details:
{details}

------

Objective:
{objective}

------

{steps}

{review}

------

Files:

{files}

------

Proceed with implementing the required changes to meet the given objective. 
Remember, using GitHub-flavored markdown for code output is mandatory and crucial for the task's success.
YOU MUST PRODUCE VALID JSON OR YOU WILL BE PENALIZED.`;

const buildPrompt = (rulePack?: string) => {
	const rulePromptAddition = !rulePack
		? ""
		: `Use the following rules to guide your code writing:
  
${rulePack}`;
	return ChatPromptTemplate.fromTemplate(
		baseWriterPrompt.replace("{RULE_PACK}", rulePromptAddition)
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
		const model = this.chatModel.withStructuredOutput(codeWriterSchema, {
			name: "code-writer",
		});
		const codeWriter = buildPrompt(rulePack).pipe(model);

		const files: CodeWriterSchema["files"] = [];

		const prompt = state
			.plan!.files!.map((f) => {
				return `File:
${f.file}

Code:
${f.code}`;
			})
			.join("\n\n---FILE---\n");

		const plan = (await codeWriter.invoke({
			details: state.projectDetails || "Not available.",
			objective: buildObjective(state),
			steps: state.steps
				? `Here are a list of steps that may help you reach your objective:
      
${state.steps.join("\n")}

------`
				: "",
			review:
				state.review?.comments?.length === 0
					? ""
					: `Here are comments from a review of your code changes.
Use these comments to refine your code and meet the objective.

${state.review?.comments?.join("\n")}

------`,
			files: `---FILE---\n${prompt}`,
		})) as CodeWriterSchema;

		const filesChanged = plan.files?.filter((f) => f.hasChanged) || [];

		if (filesChanged.length === 0) {
			throw new NoFilesChangedError(
				'No files have been changed. Please ensure you have set "hasChanged" to true for relevant files.'
			);
		}

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
		} satisfies Partial<PlanExecuteState>;
	};
}
