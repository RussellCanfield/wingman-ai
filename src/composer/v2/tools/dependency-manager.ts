import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ManualStep, PlanExecuteState } from "../types";
import {
	HumanMessage,
	SystemMessage,
} from "@langchain/core/messages";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { scanDirectory } from "../../utils";
import { promises as fs } from 'fs';
import { type Dependencies } from "@shared/types/v2/Composer";
import path from "path";

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
} as const;

class StreamParser {
	private buffer = '';
	private result: Dependencies = {
		steps: []
	};

	private isInSection(delimiter: string) {
		return this.buffer.includes(delimiter);
	}

	async parse(chunk: string): Promise<Partial<Dependencies>> {
		this.buffer += chunk;
		const updates: Partial<Dependencies> = {};

		// Check for response section
		if (this.buffer.includes('===RESPONSE_START===') && this.buffer.includes('===RESPONSE_END===')) {
			const responseContent = this.buffer.substring(
				this.buffer.indexOf('===RESPONSE_START===') + '===RESPONSE_START==='.length,
				this.buffer.indexOf('===RESPONSE_END===')
			).trim();

			if (responseContent && responseContent !== this.result.response) {
				updates.response = responseContent;
				this.result.response = responseContent;
			}
		}

		// Check for steps section
		if (this.isInSection(DELIMITERS.STEPS_START)) {
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

				if (newSteps.length > (this.result.steps?.length ?? 0)) {
					updates.steps = newSteps;
					this.result.steps = newSteps;
				}
			}
		}

		return updates;
	}

	getResult(): Dependencies {
		return this.result;
	}
}

const manualStepsPrompt = `You are a dependency and setup specialist that only reports missing dependencies that need to be installed.
Your role is to identify and list only the necessary installation commands for missing dependencies.
Do not suggest any code changes or file modifications.

Output Format:
===RESPONSE_START===
[Only include if dependencies were added: Brief statement of what was added]
===RESPONSE_END===

===STEPS_START===
---STEP---
Description: What dependency is being installed and why
Command: pnpm add package-name
---END_STEP---
===STEPS_END===

Guidelines:
1. Only include command-line steps such as installing dependencies (pnpm/npm/yarn install, pip install, etc.)
2. No file modifications or code changes
3. Use exact versions when critical
4. Specify platform-specific commands if needed
5. Provide the bare minimum steps required, no extraneous steps
6. Analyze provided files to determine if the dependencies need to be added or changed
7. If no new dependencies are required, provide a response indicating this

Project details:
{{details}}

Workspace:
{{workspace}}

Request:
{{request}}

Dependency management files available:
{{dependencyFiles}}`;

const buildManualStepsPrompt = ({
	projectDetails,
	request,
	dependencyFiles,
	workspace
}: Pick<BuildPromptParams, 'projectDetails' | 'request'> & { dependencyFiles: string, workspace: string }) => {
	return manualStepsPrompt
		.replace("{{details}}", projectDetails)
		.replace("{{request}}", request)
		.replace("{{dependencyFiles}}", dependencyFiles)
		.replace("{{workspace}}", workspace)
};

export class DependencyManager {
	private INITIAL_SCAN_DEPTH = 5;

	constructor(
		private readonly chatModel: BaseChatModel,
		private readonly rerankModel: BaseChatModel,
		private readonly workspace: string
	) { }

	generateManualSteps = async (
		state: PlanExecuteState,
	) => {
		const dependencies = await this.handleDependencies(state);
		await dispatchCustomEvent("composer-done", {
			...state,
			dependencies
		});
	}

	private async handleDependencies(state: PlanExecuteState): Promise<Dependencies | undefined> {
		// Return empty array if no files to process
		if (!state.files) {
			return;
		}

		// Extract dependencies from all files
		const codeDependencies: string[] = state.files.flatMap(f => f.dependencies ?? []);
		if (!codeDependencies?.length) {
			return;
		}

		// Get dependency management files
		const files = await this.locateDependencyManagementFiles(
			state.files,
			this.workspace,
			state.projectDetails,
			state.scannedFiles
		);

		// Build prompt for dependency installation steps
		const systemMessage = new SystemMessage({
			content: buildManualStepsPrompt({
				projectDetails: state.projectDetails || "Not available.",
				request: `Install new dependencies, if they do not already exist: ${codeDependencies.join(', ')}`,
				dependencyFiles: files.map(f => `File:\n${f.path}\n\nContent:\n${f.content}`).join('\n\n----FILE SEPARATOR----\n\n'),
				workspace: this.workspace
			})
		});

		// Stream and parse the response
		const parser = new StreamParser();
		let dependencies: Dependencies | undefined;

		const stream = await this.chatModel.stream([
			systemMessage,
			new HumanMessage({
				content: [
					{
						type: "text",
						text: `Required dependencies:\n${codeDependencies.join('\n')}`,
					},
				],
			})
		]);

		// Process stream chunks
		for await (const chunk of stream) {
			const updates = await parser.parse(chunk.content.toString());
			if (updates.steps?.length) {
				dependencies = {
					...dependencies,
					...updates
				};
			}
		}

		return dependencies;
	}

	private async locateDependencyManagementFiles(
		inContextFiles: PlanExecuteState["files"],
		workspace: string,
		projectDetails?: string,
		availableFiles?: PlanExecuteState["scannedFiles"]
	) {
		const directoryFiles = availableFiles ?? await scanDirectory(workspace, this.INITIAL_SCAN_DEPTH);

		const systemPrompt = `You are a dependency file specialist. Analyze the provided file paths and identify files that manage dependencies.
Pay special attention to monorepo configurations at all levels of the directory structure.

Your primary tasks:
1. Identify ALL dependency management files, including workspace configurations
2. Always check for monorepo configurations, even if not immediately apparent
3. Traverse up directory tree to find root workspace configurations
4. Consider all package manager workspace files
5. Include all relevant package.json files in workspaces
6. Check for specialized monorepo tools

Files to ALWAYS check (in order of priority):
1. Monorepo Specific:
	- pnpm-workspace.yaml
	- lerna.json
	- nx.json
	- turbo.json
	- rush.json
	- .yarnrc.yml
	- workspace.json
	
2. Package Managers:
	- package.json (check "workspaces" field)
	- yarn.lock
	- pnpm-lock.yaml
	- package-lock.json
	
3. Language Specific:
	- requirements.txt (Python)
	- *.csproj (C#)
	- build.gradle (Java/Kotlin)
	- Cargo.toml (Rust)
	- go.mod (Go)
	- composer.json (PHP)
	- *.gemspec (Ruby)

Dependency Resolution Strategy:
1. Start at current directory
2. Scan upwards for workspace root
3. Include ALL workspace package.json files
4. Include ALL monorepo config files
5. Check for nested workspaces
6. Include lockfiles for dependency verification

STRICT OUTPUT FORMAT REQUIREMENTS:
1. Output must be valid JSON only
2. No explanatory text before or after the JSON
3. No markdown formatting
4. No comments or additional information
5. Must match this exact structure:
{
	"files": string[]
}

Example valid response:
{"files":["/root/pnpm-workspace.yaml","/root/package.json","/root/packages/app/package.json"]}

Example empty response:
{"files":[]}

Any deviation from this format will cause a parsing error.`;

		const response = await this.chatModel.invoke([
			new SystemMessage({ content: systemPrompt }),
			new HumanMessage({
				content: [{
					type: "text",
					text: `Project Details: ${projectDetails || 'Not available'}

Workspace: ${workspace}

Directory Files:\n${directoryFiles.filter(f => f.type === "file").join('\n')}

Recently modified files:\n${inContextFiles?.map(f => {
						const filePath = path.isAbsolute(f.path)
							? f.path
							: path.join(workspace, f.path);

						return `File:\n${filePath}\n\nContents:\n${f.code}`
					}).join('\n\n---FILE SEPARATOR---\n\n')}`
				}]
			})
		]);

		try {
			const fileSet = new Set<string>();
			for (const { path } of directoryFiles) {
				fileSet.add(path);
			}

			const result = JSON.parse(response.content.toString()) as { files: string[] };
			const filteredFiles = result.files.filter(f => f && fileSet.has(f));

			// Ensure we get unique files
			const uniqueFiles = [...new Set(filteredFiles)];

			const filesWithContents: Array<{ path: string, content: string }> = [];
			for (const file of uniqueFiles) {
				try {
					const filePath = path.isAbsolute(file)
						? file
						: path.join(workspace, file);

					filesWithContents.push({
						path: file,
						content: (await fs.readFile(filePath)).toString()
					});
				} catch (e) {
					console.warn(`Failed to read file: ${file}`, e);
				}
			}

			return filesWithContents;
		} catch (e) {
			console.warn('Failed to parse dependency files response', e);
			return [];
		}
	}
}