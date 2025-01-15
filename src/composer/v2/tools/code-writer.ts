import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlanExecuteState } from "../types";
import { formatMessages, loadWingmanRules } from "../../utils";
import { NoFilesChangedError } from "../../errors";
import {
	HumanMessage,
	SystemMessage,
} from "@langchain/core/messages";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { FileMetadata } from "@shared/types/Message";
import { getTextDocumentFromPath } from "../../../server/files/utils";
import path from "node:path";

type CodeResponse = {
	description: string;
	steps: Array<{
		description: string;
		command?: string;
	}>;
	file: {
		path: string;
		code: string;
		markdownLanguage: string;
		changes?: string[];
	};
};

type BuildPromptParams = {
	projectDetails: string;
	request: string;
	modifiedFiles: string;
	availableFiles: string;
	rulePack?: string;
};

const DELIMITERS = {
	STEPS_START: '===STEPS_START===',
	STEPS_END: '===STEPS_END===',
	STEP_START: '---STEP---',
	STEP_END: '---END_STEP---',
	FILE_START: '===FILE_START===',
	FILE_END: '===FILE_END==='
} as const;

const FILE_SEPARATOR = "<FILE_SEPARATOR>";

const parseResponse = (response: string): CodeResponse => {
	// Helper to extract content between delimiters
	const extractSection = (start: string, end: string, content: string) => {
		const regex = new RegExp(`${start}\\n([\\s\\S]*?)\\n${end}`);
		const match = content.match(regex);
		return match ? match[1].trim() : '';
	};

	// Extract initial description (any text before first delimiter)
	const firstDelimiter = response.match(new RegExp(`(${DELIMITERS.STEPS_START}|${DELIMITERS.FILE_START})`));
	const description = firstDelimiter
		? response.substring(0, firstDelimiter.index).trim()
		: '';

	// Parse steps section
	const stepsContent = extractSection(DELIMITERS.STEPS_START, DELIMITERS.STEPS_END, response);
	const steps: CodeResponse['steps'] = [];

	if (stepsContent) {
		// Split into individual steps
		const stepBlocks = stepsContent.split(DELIMITERS.STEP_START)
			.filter(block => block.trim())
			.map(block => block.split(DELIMITERS.STEP_END)[0].trim());

		// Parse each step
		for (const block of stepBlocks) {
			const descMatch = block.match(/Description: (.*?)(?:\nCommand:|$)/s);
			const cmdMatch = block.match(/Command: (.*?)$/s);

			if (descMatch) {
				steps.push({
					description: descMatch[1].trim(),
					command: cmdMatch?.[1].trim()
				});
			}
		}
	}

	// Parse file section
	const fileContent = extractSection(DELIMITERS.FILE_START, DELIMITERS.FILE_END, response);
	const file: CodeResponse['file'] = {
		path: '',
		code: '',
		markdownLanguage: '',
		changes: []
	};

	if (fileContent) {
		// Extract path
		const pathMatch = fileContent.match(/Path: (.*?)(?:\n|$)/);
		if (pathMatch) {
			file.path = pathMatch[1].trim();
		}

		// Extract language
		const langMatch = fileContent.match(/Language: (.*?)(?:\n|$)/);
		if (langMatch) {
			file.markdownLanguage = langMatch[1].trim();
		}

		// Extract code (everything between Code: and Changes:)
		const codeMatch = fileContent.match(/Code:\n([\s\S]*?)(?=\nChanges:|$)/);
		if (codeMatch) {
			file.code = codeMatch[1].trim();
		}

		// Extract changes
		const changesMatch = fileContent.match(/Changes:\n([\s\S]*?)$/);
		if (changesMatch) {
			file.changes = changesMatch[1]
				.split('\n')
				.map(line => line.trim())
				.filter(line => line.startsWith('- '))
				.map(line => line.slice(2));
		}
	}

	return { description, steps, file };
};

const codeWriterPrompt = `You are a senior full-stack developer with exceptional technical expertise, focused on writing clean, maintainable code for AI-powered development tools.

Output Structure:
1. Steps: Concise guide for manual implementation steps
	- Includes commands the user needs to run
	- Excludes available files or code modifications
	- Omit if no manual steps
2. File: Modified or created code for the file in scope
	- Include "Changes" made to the file in a concise format

Output Format Example:
===STEPS_START===
---STEP---
Description: Install required dependency
Command: npm install package-name
---END_STEP---
===STEPS_END===

===FILE_START===
Path: /path/to/file
Language: typescript
Code:
// Your actual code here
Changes:
- Added new function
- Updated imports
===FILE_END===

Core Principles:
1. Write simple, maintainable code - less code equals debt
2. Focus on readability over optimization
3. Ensure code correctness and reliability
4. Maintain existing patterns and conventions
5. Make minimal, focused changes

File Handling:
1. Process one file at a time
2. Only modify/create files relevant to objective
3. Use provided file paths as reference
4. Omit irrelevant or unchanged files
5. Provide full, functional code responses
6. Always include complete file paths
7. List only files with actual changes
8. Write the best possible code
9. Ensure human readability
10. Preserve existing code structure

Implementation Guidelines:

1. Code Structure
   - Use early returns to reduce nesting
   - Order functions logically
   - Maintain consistent formatting
   - Follow established naming conventions
   - Use TypeScript features appropriately
   - Focus strictly on files in scope
   - Ensure relative file references
   - Preserve existing structure/comments

2. Best Practices
   - Write self-documenting code
   - Handle errors appropriately
   - Consider edge cases
   - Follow security best practices
   - Use meaningful names
   - Document complex logic
   - Follow DRY principles
   - Optimize for maintainability

3. Integration Requirements
   - Work within existing dependencies
   - Maintain file structure conventions
   - Handle imports/exports properly
   - Preserve functionality
   - Prevent regression bugs
   - Consider integration points
   - Ensure seamless component integration

4. Documentation
   - Document complex logic
   - Use JSDoc when appropriate
   - Add TODO comments for known issues
   - Maintain existing comments
   - Update documentation as needed
   - Keep comments focused and minimal

5. Quality Constraints
   - Write testable code
   - Consider performance implications
   - Use immutable patterns where appropriate
   - Maintain type safety
   - Handle edge cases
   - Follow security best practices
   - Use proper error handling/logging

{{rulepack}}

------

Use the following project context to assist in choosing available technology:

{{details}}

------

{{request}}

------

Files available to create or modify:
{{availableFiles}}

{{modified}}

------

Remember:
- Only modify task-related code
- Preserve existing structure
- Focus on core objective
- Write maintainable code
- Handle edge cases
- Integrate seamlessly
- Optimize for maintainability
- Make minimal necessary changes`;

const buildPrompt = ({
	projectDetails,
	request,
	modifiedFiles,
	availableFiles,
	rulePack,
}: BuildPromptParams) => {
	const rulePromptAddition = !rulePack
		? ""
		: `Use the following rules to guide your code writing:
  
${rulePack}`;

	return codeWriterPrompt
		.replace("{{rulepack}}", rulePromptAddition)
		.replace("{{details}}", projectDetails)
		.replace("{{request}}", request)
		.replace("{{modified}}", modifiedFiles)
		.replace("{{availableFiles}}", availableFiles);
};

export class CodeWriter {
	constructor(
		private readonly chatModel: BaseChatModel,
		private readonly workspace: string
	) { }

	codeWriterStep = async (
		state: PlanExecuteState
	): Promise<Partial<PlanExecuteState>> => {
		const rulePack = loadWingmanRules(this.workspace);
		const request = formatMessages(state.messages);

		const codeWriter = this.chatModel;

		const files: FileMetadata[] = [];
		const steps: CodeResponse["steps"] = [];
		for (let { path: file, code } of state.files || [
			{
				path: "BLANK",
				changes: [],
				code: "",
			},
		]) {
			if (!code) {
				const textDocument = await getTextDocumentFromPath(path.join(this.workspace, file));
				code = textDocument?.getText();
			}

			const systemMessage = new SystemMessage({
				content: [
					{
						type: "text",
						cache_control: { type: "ephemeral" },
						text: buildPrompt({
							projectDetails:
								state.projectDetails || "Not available.",
							request,
							modifiedFiles:
								files.length === 0
									? ""
									: `Context: Previously Modified/Created Files
    
The following list contains files you have already processed, along with their changes. 
Use this information as context for subsequent file processing. Do not modify these files again.
Note: Consider dependencies between these files and the file you are currently processing.

${files.map(
										(f) => `File:\n${f.path}\n\nChanges:\n${f.changes?.join("\n")}`
									).join('\n')}

------`,
							availableFiles:
								state.files
									?.filter((f) => f.path !== file)
									?.map(
										(f) => `${FILE_SEPARATOR}
              
File:
${f.path}

Code:
${f.code}`
									)
									.join(`\n\n${FILE_SEPARATOR}\n\n`) || "",
							rulePack,
						}),
					},
				],
			});

			const output = (await codeWriter.invoke([
				systemMessage,
				new HumanMessage({
					content: [
						{
							type: "text",
							text: `Here is the file currently in scope:
            
${file === "BLANK"
									? `The user does not currently have any related files, assume this may be a new project and this is your current working directory: ${this.workspace}`
									: `File:\n${file}\n\nCode:\n${code}`
								}`,
						},
					],
				}),
			]));

			const result = parseResponse(output.content.toString());

			const fileChanged =
				result.file.changes && result.file.changes.length > 0;

			steps.push(...(result.steps ?? []));

			await dispatchCustomEvent("composer-manual-steps", {
				steps
			} satisfies Partial<PlanExecuteState>);

			if (!files.some((f) => f.path === result.file.path) && fileChanged) {
				const stateFile = state?.files?.find(f => f.path === result.file.path);

				if (stateFile) {
					stateFile.language = result.file.markdownLanguage;
					stateFile.code = result.file.code;
					stateFile.changes = result.file.changes ?? [];
					stateFile.description = result.description;

					files.push(stateFile);
					await dispatchCustomEvent("composer-files", {
						files: state.files
					} satisfies Partial<PlanExecuteState>);
				}
			}
		}

		if (files.length === 0) {
			throw new NoFilesChangedError("No files have been changed.");
		}

		const updatedPlan: Partial<PlanExecuteState> = {
			files,
			steps
		}

		await dispatchCustomEvent("composer-done", updatedPlan);

		return updatedPlan;
	};
}