import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlanExecuteState } from "../types";
import { loadWingmanRules } from "../../utils";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { FileMetadata } from "@shared/types/v2/Message";
import path from "node:path";
import { createPatch } from 'diff';
import fs, { promises } from "node:fs";
import { Command } from "@langchain/langgraph";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate, HumanMessagePromptTemplate, PromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { AIProvider } from "../../../service/base";

export type CodeResponse = FileMetadata & { markdownLanguage: string };

const codeWriterPrompt = `You are a senior full-stack developer with exceptional technical expertise, focused on writing clean, maintainable code.
For each file you modify, output two parts in sequence:
1. A one-line description of the changes for that file.
2. The complete file block containing the updated code.
3. The [] surrounding instructions in the response format should not be included in your final response.

**CRITICAL RESPONSE FORMAT - FOLLOW EXACTLY:**

For each file, first output a description line in the following format (do not wrap it in any additional markers):
[Brief summary of the changes made to the file]

Then, immediately output the file block exactly in the format below:
===FILE_START===
Path: [Workspace relative file path]
Language: [Programming language]
Code:
[Complete file code]
===FILE_END===

-----

VALIDATION RULES:
1. Each file block MUST contain exactly 3 fields: Path, Language, and Code
2. Path should not be modified, use the provided current file path
3. Language MUST be specified
4. Code MUST be complete and functional
5. No explanatory text outside the defined sections
6. No additional formatting or sections allowed
7. All field values mentioned above in the file block are in a string format.
8. Do not wrap any fields in quotes!

Core Principles:
1. Write simple, maintainable code - less code equals less debt
2. Focus on readability over optimization
3. Ensure code correctness and reliability
4. Maintain existing patterns and conventions
5. Make minimal, focused changes
6. Do not remove existing code unless it is required to complete your change, do not break things - THIS IS CRITICAL!
7. Be surgical, make the necessary changes only. Think very carefully before deleting code - stay focused.

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
   - Add all necessary endpoints required to run the code.
   - Write self-documenting code
   - Handle errors appropriately
   - Consider edge cases
   - Follow security best practices
   - Use meaningful names
   - Document complex logic
   - Follow DRY principles
   - Optimize for maintainability
   - Add or modify all necessary import statements required to run the code.
   - Always build a modern and beautiful UI, imbued with best UX practices.
   - You MUST read the the contents or section of what you're editing before editing it.

3. Integration Requirements
   - Maintain file structure conventions
   - Handle imports/exports properly
   - Preserve functionality
   - Prevent regression bugs
   - Consider integration points
   - Ensure seamless component integration
   - Pay special attention to named and default exports in javascript. Use named exports as your default.

4. Documentation
   - Document complex logic
   - Use JSDoc when appropriate
   - Add TODO comments for known issues
   - Maintain existing comments
   - Update documentation as needed
   - Keep comments focused and minimal
   - Do not include extraneous comments, only comment on critical or complex areas.

5. Quality Constraints
   - Write testable code
   - Consider performance implications
   - Use immutable patterns where appropriate
   - Maintain type safety
   - Handle edge cases
   - Follow security best practices
   - Use proper error handling/logging

6. Framework-Specific Considerations
	- Identify framework-specific best practices
	- Include necessary framework configurations
	- Set up proper routing structure
	- Plan state management approach
	- Consider component composition
	- Plan data fetching strategy
	- Consider SSR/SSG requirements

7. Development Environment Setup
    - Define development tools requirements
    - Plan local development workflow
    - Set up debugging configurations
    - Define code quality tools
    - Plan hot reload strategy
    - Consider development vs production configs

{{rulepack}}

------

Project details:
{{projectdetails}}

------

Implementation plan:
{{implementationplan}}

------

{{modifiedfiles}}

Files available for reference:
{{availablefiles}}

------

Remember:
- Follow the strict output format
- Only modify task-related code
- Preserve existing structure
- Focus on core objective
- Write maintainable code
- Handle edge cases
- Integrate seamlessly
- Optimize for maintainability
- Make minimal necessary changes
- Do not remove code that isn't related to your objective, do not break things or introduce bugs - THIS IS CRITICAL!`;

const DELIMITERS = {
	FILE_START: '===FILE_START===',
	FILE_END: '===FILE_END==='
} as const;

const FILE_SEPARATOR = "<FILE_SEPARATOR>";

class StreamParser {
	private buffer = '';
	private isInFileSection = false;
	private streamingDescription = '';
	private result: CodeResponse = {
		path: '',
		code: '',
		markdownLanguage: '',
		description: '',
		lastModified: Date.now()
	};

	constructor(private readonly workspace: string) { }

	private async generateDiffFromModifiedCode(newCode: string, filePath: string): Promise<string> {
		try {
			if (!filePath) {
				throw new Error('File path is required');
			}

			if (typeof newCode !== 'string') {
				throw new Error('New code must be a string');
			}

			// Read existing file contents with error handling
			let fileContents = '';
			if (fs.existsSync(filePath)) {
				try {
					fileContents = await promises.readFile(filePath, { encoding: 'utf-8' });
				} catch (e) {
					console.warn(`Failed to read file ${filePath}:`, e);
					// Continue with empty string for new files
				}
			}

			const patch = createPatch(
				filePath,
				fileContents,
				newCode,
				'',
				'',
				{ context: 3 }  // Optional: control context lines
			);

			const stats = {
				additions: 0,
				deletions: 0
			};

			// Safer line parsing
			const lines = patch.split('\n');
			for (const line of lines) {
				// Skip diff headers and metadata
				if (line.startsWith('+++') ||
					line.startsWith('---') ||
					line.startsWith('Index:') ||
					line.startsWith('===') ||
					line.startsWith('@@') ||
					line.startsWith('\\')) {
					continue;
				}

				if (line.startsWith('+')) {
					stats.additions++;
				} else if (line.startsWith('-')) {
					stats.deletions++;
				}
			}

			return `+${stats.additions},-${stats.deletions}`;
		} catch (error) {
			console.error('Error generating diff:', error);
			return '+0,-0'; // Safe fallback
		}
	}

	parseToken = async (token: string): Promise<{ text: string | null; result?: Partial<CodeResponse> }> => {
		// Append new token data to the buffer.
		this.buffer += token;

		// If we have encountered the file block marker and we're not already in a file section,
		// then split the buffer to capture the description.
		if (this.buffer.includes(DELIMITERS.FILE_START) && !this.isInFileSection) {
			this.isInFileSection = true;
			// Everything before the file start is the description.
			const parts = this.buffer.split(DELIMITERS.FILE_START);
			this.streamingDescription = parts[0].trim();
			this.result.description = this.streamingDescription;
			// Remove the file start marker from the buffer.
			this.buffer = parts[1] || '';
			// Return the description content (if needed).
			return {
				text: parts[0] || null,
			};
		}

		// When we detect the end of the file block, process the file.
		if (this.buffer.includes(DELIMITERS.FILE_END) && this.isInFileSection) {
			// Extract and process the file block.
			await this.processFileContent();
			// Remove the file end marker and everything before it.
			this.buffer = this.buffer.substring(
				this.buffer.indexOf(DELIMITERS.FILE_END) + DELIMITERS.FILE_END.length
			);
			this.isInFileSection = false;
			return {
				text: null,
				result: { ...this.result },
			};
		}

		// If not yet in file section, keep appending to the description.
		if (!this.isInFileSection) {
			this.streamingDescription += token;
			this.result.description = this.streamingDescription;
			return { text: token };
		}

		// While in the file section and no end marker is encountered, return nothing.
		return { text: null };
	};

	private async processFileContent() {
		// With the new logic, the file content is from the start of the buffer until the FILE_END token.
		const endIndex = this.buffer.indexOf(DELIMITERS.FILE_END);
		const fileContent = this.buffer.substring(0, endIndex).trim();

		// Use improved regex patterns to extract fields.
		const pathPattern = /^Path:\s*(?:`)?([^`\n]+)(?:`)?/m;
		const langPattern = /^Language:\s*([^\n]+)/m;
		// Allow "Code:" to be followed by an optional newline, then capture everything.
		const codePattern = /^Code:\s*\n?([\s\S]+)/m;

		const pathMatch = fileContent.match(pathPattern);
		const langMatch = fileContent.match(langPattern);
		const codeMatch = fileContent.match(codePattern);

		// Normalize the file path (remove any quotes/backticks).
		const normalizedPath = pathMatch?.[1]?.replace(/[`'"]/g, '').trim() || '';

		const fileUpdate: CodeResponse = {
			path: normalizedPath,
			markdownLanguage: langMatch?.[1]?.trim() || '',
			description: this.streamingDescription,
			code: codeMatch?.[1]?.trim() || '',
			lastModified: Date.now(),
		};

		if (!fileUpdate.path) {
			console.error('Invalid file path in content:', fileContent);
			return;
		}

		// Process the file update asynchronously.
		await this.processFileDiff(fileUpdate);

		// Update the overall result with the current file update.
		this.result = fileUpdate;
	}


	private async processFileDiff(fileUpdate: CodeResponse) {
		if (fileUpdate.code && !fileUpdate.diff) {
			try {
				const filePath = path.isAbsolute(fileUpdate.path)
					? fileUpdate.path
					: path.join(this.workspace, fileUpdate.path);

				fileUpdate.diff = await this.generateDiffFromModifiedCode(fileUpdate.code, filePath);
			} catch (e) {
				console.error('Unable to generate diff for:', fileUpdate.path, e);
			}
		}
	}

	getResult(): CodeResponse {
		return this.result;
	}
}

export class CodeWriter {
	private readonly tools: DynamicStructuredTool<any>[];
	private readonly model: BaseChatModel;

	constructor(
		private readonly aiProvider: AIProvider,
		private readonly workspace: string
	) {
		this.tools = [];
		this.model = this.aiProvider.getModel();
	}

	codeWriterStep = async (state: PlanExecuteState) => {
		const rulePack = await loadWingmanRules(this.workspace);
		const files: FileMetadata[] = [];

		const executeStep = async (includeImage: boolean) => {
			const humanMsg = [];

			if (includeImage && state.image) {
				humanMsg.push({
					type: "image_url",
					image_url: {
						url: "{{imageurl}}",
					}
				});
			}

			humanMsg.push({
				type: "text",
				text: "{{input}}"
			});

			await dispatchCustomEvent('composer-files', { files: [] });
			for (let { path: file, code } of state.files ?? []) {
				const systemTemplate = PromptTemplate.fromTemplate(codeWriterPrompt,
					{ templateFormat: "mustache" }
				);

				const humanTemplate = PromptTemplate.fromTemplate(
					JSON.stringify(humanMsg),
					{ templateFormat: "mustache" }
				);

				const baseMessages = [
					new SystemMessagePromptTemplate(systemTemplate),
					new HumanMessagePromptTemplate(humanTemplate)
				];

				const chatPrompt = ChatPromptTemplate.fromMessages([
					...baseMessages,
					["placeholder", "{agent_scratchpad}"]
				]);

				// Prepare the variables for formatting
				const variables = {
					projectdetails: state.projectDetails || "Not available.",
					implementationplan: state.implementationPlan!,
					modifiedfiles: files.length === 0 ? "" :
						`Files already processed, do not process again:\n${files.map(f =>
							`File: ${f.path}\nChanges Made: ${f.description}`
						).join('\n')}`,
					availablefiles: state.files
						?.filter((f) => f.path !== file)
						?.map((f) => `${FILE_SEPARATOR}\nFile: ${f.path}\nDescription: ${f.description}\nCode:\n${f.code ?? "(New File)"}`)
						.join(`\n\n${FILE_SEPARATOR}\n\n`) || "",
					rulepack: rulePack || "No extra rules provided",
					input: `Current file:\n${file === "BLANK"
						? `No related files found. Working directory:\n${this.workspace}`
						: `File:\n${file}\n\nCode:\n${code ?? "(New File)"}`}`,
					imageurl: state.image?.data
				};

				try {
					let buffer = '';
					const agent = createToolCallingAgent({
						llm: this.model,
						tools: this.tools,
						prompt: chatPrompt,
					});

					const executor = new AgentExecutor({
						agent,
						tools: this.tools
					});

					const parser = new StreamParser(this.workspace);

					for await (const event of await executor.streamEvents(
						variables,
						{ version: "v2" }
					)) {
						switch (event.event) {
							case "on_chat_model_stream":
								if (event.data.chunk?.content) {
									const chunk = Array.isArray(event.data.chunk.content) ?
										event.data.chunk.content[0]?.text || ''
										:
										event.data.chunk.content.toString();

									buffer += chunk;

									const updates = await parser.parseToken(chunk);
									const file = updates?.result;

									if (file) {
										if (!file.code) {
											await dispatchCustomEvent("composer-error", {
												error: `I was unable to generate code for the following file: ${file.path}, please try again.`,
											});
											return new Command({
												goto: "find",
											});
										}

										const stateFile = state?.files?.find(f => f.path === file?.path);
										if (stateFile && !files.some(f => f.path === file?.path)) {
											Object.assign(stateFile, file, {
												accepted: false,
												rejected: false
											});

											const filePath = path.isAbsolute(this.workspace) ?
												stateFile.path :
												path.join(this.workspace, stateFile.path);

											if (fs.existsSync(filePath)) {
												stateFile.original = (await promises.readFile(filePath)).toString();
											}

											files.push(stateFile);
											await dispatchCustomEvent('composer-files', { files: state.files });
										}
									}
								}
								break;
						}
					}
				} catch (error) {
					const errorMessage = error?.toString?.() || '';
					if (includeImage && (
						errorMessage.includes('image') ||
						errorMessage.includes('multimodal') ||
						errorMessage.includes('unsupported')
					)) {
						await dispatchCustomEvent("composer-warning", {
							warning: "Image processing not supported by the model. Retrying without image...",
						});
						return false;
					}
					throw error;
				}
			}
			return true;
		};

		const success = await executeStep(true);
		if (!success && state.image) {
			await executeStep(false);
		}

		if (files.length === 0) {
			throw new Error("I've failed to generate any code changes for this session, if this continues please clear the chat and try again.");
		}

		await dispatchCustomEvent("composer-files-done", {
			files,
			messages: state.messages
		})

		return {
			files
		} satisfies Partial<PlanExecuteState>;
	}
}