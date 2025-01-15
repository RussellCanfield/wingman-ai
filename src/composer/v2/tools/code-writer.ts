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
import { GitCommandEngine } from "../../../utils/gitCommandEngine";
import { createPatch } from 'diff';
import fs from "node:fs";

type CodeResponse = {
	steps: Array<{
		description: string;
		command?: string;
	}>;
	file: {
		description: string;
		path: string;
		code: string;
		markdownLanguage: string;
		diff?: string;
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

class StreamParser {
	private buffer = '';
	private currentSection: 'steps' | 'file' | null = null;
	private gitCommands: GitCommandEngine | undefined;
	private result: CodeResponse = {
		steps: [],
		file: {
			path: '',
			code: '',
			markdownLanguage: '',
			description: '',
		}
	};

	constructor(private readonly workspace: string) {
		this.gitCommands = new GitCommandEngine(process.cwd());
	}

	private isInSection(delimiter: string) {
		return this.buffer.includes(delimiter);
	}

	private generateDiffFromModifiedCode(newCode: string, filePath: string): string {
		let fileContents = '';

		if (fs.existsSync(filePath)) {
			fileContents = fs.readFileSync(filePath, { encoding: "utf-8" });
		}

		const patch = createPatch(
			filePath,           // filename for the diff header
			fileContents || '', // original content
			newCode || '',      // new content
			'',                 // optional old header
			'',                 // optional new header
		);

		// Calculate diff statistics
		const stats = {
			additions: 0,
			deletions: 0
		};

		// Parse the patch line by line to count additions and deletions
		const lines = patch.split('\n');
		for (const line of lines) {
			if (line.startsWith('+') && !line.startsWith('+++')) {
				stats.additions++;
			} else if (line.startsWith('-') && !line.startsWith('---')) {
				stats.deletions++;
			}
		}

		return `+${stats.additions},-${stats.deletions}`;
	}

	async parse(chunk: string): Promise<Partial<CodeResponse>> {
		this.buffer += chunk;

		// Determine current section
		if (this.isInSection(DELIMITERS.STEPS_START)) {
			this.currentSection = 'steps';
		} else if (this.isInSection(DELIMITERS.FILE_START)) {
			this.currentSection = 'file';
		}

		const updates: Partial<CodeResponse> = {};

		switch (this.currentSection) {
			case 'steps':
				if (this.isInSection(DELIMITERS.STEPS_END)) {
					const stepsContent = this.buffer.substring(
						this.buffer.indexOf(DELIMITERS.STEPS_START) + DELIMITERS.STEPS_START.length,
						this.buffer.indexOf(DELIMITERS.STEPS_END)
					);

					const newSteps = stepsContent
						.split(DELIMITERS.STEP_START)
						.filter(block => block.trim())
						.map(block => {
							const stepContent = block.split(DELIMITERS.STEP_END)[0].trim();
							const descMatch = stepContent.match(/Description: (.*?)(?:\nCommand:|$)/s);
							const cmdMatch = stepContent.match(/Command: (.*?)$/s);

							return {
								description: descMatch?.[1].trim() || '',
								command: cmdMatch?.[1].trim()
							};
						})
						.filter(step => step.description);

					if (newSteps.length > this.result.steps.length) {
						updates.steps = newSteps;
						this.result.steps = newSteps;
					}
				}
				break;

			case 'file':
				if (this.isInSection(DELIMITERS.FILE_END)) {
					const fileContent = this.buffer.substring(
						this.buffer.indexOf(DELIMITERS.FILE_START) + DELIMITERS.FILE_START.length,
						this.buffer.indexOf(DELIMITERS.FILE_END)
					);

					const pathMatch = fileContent.match(/Path: (.*?)(?:\n|$)/);
					const langMatch = fileContent.match(/Language: (.*?)(?:\n|$)/);
					const descMatch = fileContent.match(/Description: (.*?)(?:\n|$)/);
					const codeMatch = fileContent.match(/Code:\n([\s\S]*?)$/);

					const fileUpdate: CodeResponse['file'] = {
						path: pathMatch?.[1].trim() || '',
						markdownLanguage: langMatch?.[1].trim() || '',
						description: descMatch?.[1].trim() || '',
						code: codeMatch?.[1].trim() || ''
					};

					if (fileUpdate.code) {
						fileUpdate.diff = this.generateDiffFromModifiedCode(fileUpdate.code, path.join(this.workspace, fileUpdate.path));
					}

					updates.file = fileUpdate;
					this.result.file = fileUpdate;
				}
				break;
		}

		return updates;
	}

	getResult(): CodeResponse {
		return this.result;
	}
}

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
Description: A short and concise summary of what you changed in the file.
Code:
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

Previous conversation and latest request:

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
		private readonly rerankModel: BaseChatModel,
		private readonly workspace: string
	) { }

	codeWriterStep = async (
		state: PlanExecuteState
	) => {
		const rulePack = loadWingmanRules(this.workspace);
		const request = formatMessages(state.messages);

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
									: `-------\n\nContext: Previously Modified/Created Files
    
The following list contains files you have already processed, along with a description of their changes. 
Use this information as context for subsequent file processing. Do not modify these files again.
Note: Consider dependencies between these files and the file you are currently processing.

${files.map(
										(f) => `File:\n${f.path}\n\Changes:\n${f.description}`
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

			const parser = new StreamParser(this.workspace);

			for await (const chunk of await this.chatModel.stream([systemMessage, new HumanMessage({
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
			})])) {
				const updates = await parser.parse(chunk.content.toString());

				if (updates.steps?.length) {
					steps.push(...updates.steps);
					await dispatchCustomEvent('composer-manual-steps', { steps });
				}

				if (updates.file) {
					const stateFile = state?.files?.find(f => f.path === updates.file?.path);
					if (stateFile && !files.some(f => f.path === updates.file?.path)) {
						stateFile.language = updates.file.markdownLanguage;
						stateFile.code = updates.file.code;
						stateFile.description = updates.file.description;
						stateFile.diff = updates.file.diff;

						files.push(stateFile);
						await dispatchCustomEvent('composer-files', { files: state.files });
					}
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
	}
}