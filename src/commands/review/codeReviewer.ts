import * as vscode from "vscode";
import { DiffGenerator } from "../../utils/diffGenerator";
import { AIProvider } from "../../service/base";
import {
	CodeCommentAction,
	CodeReviewComment,
	FileDetails,
	FileReviewDetails,
} from "@shared/types/Message";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const REVIEW_SEPARATOR = "====WINGMAN====";

export class CodeReviewer {
	private diffGenerator: DiffGenerator;

	constructor(
		private readonly _workspace: string,
		private readonly _aiProvider: AIProvider
	) {
		this.diffGenerator = new DiffGenerator(this._workspace);
	}

	async generateDiffsAndSummary(instructions: string) {
		try {
			const fileDiffMap =
				await this.diffGenerator.generateDiffWithLineNumbersAndMap();

			if (fileDiffMap) {
				// Use the cheaper model for summaries
				const model = this._aiProvider.getRerankModel();
				const summary =
					await model.invoke(`You are a senior software engineer tasked with generating a concise summary of a pull request.
Use the following files and associated git diffs to the summary.
Do not include introduction text or any other text, just return your review.
Generate the following sections:

**Summary**
- Provide an overall summary of the pull request.
- Generate no more than one paragraph detailing the overall business intent of the changes.
- Use confident, clear language.
- Do not reference individual files in the summary.

**File Summaries**
- For each file include a short and concise summary of the changes, no more than two sentences per file.
- Use bulleted list.

**Key Modifications**
- Key modifications serve as business feature outlines or domain features.
- Focus on their primary purpose and the impact of the changes.
- Use bulleted list.

Example output:

### Summary
<text>

### File Summaries
<text>

### Key Modifications
<text>

-------

Return your response using a GitHub markdown format using plaintext.

-------

Here is additional information/instructions from the user to take into consideration:

${instructions || "None provided."}

-------

${Object.entries(fileDiffMap)
	.map(([file, diff]) => {
		return `File: 
${file}

Changes:
${diff.diff}
`;
	})
	.join("\n\n-------\n\n")})}`);

				return { summary: summary.content.toString(), fileDiffMap };
			}
		} catch (error) {
			if (error instanceof Error) {
				vscode.window.showErrorMessage(
					`Failed to start code review: ${error.message}`
				);
			}
		}
	}

	async reviewFile(fileDetails: FileDetails): Promise<FileReviewDetails> {
		const model = this._aiProvider.getModel();
		const reviewResponse = await model.invoke([
			new SystemMessage({
				content: [
					{
						type: "text",
						cache_control: { type: "ephemeral" },
						text: `You are a senior software engineer reviewing code changes.
Your task is to review the diff of a file based on the criteria below and determine if there are actionable suggestions.
Take a deep breathe and focus on the code provided, be thorough.
Provide actionable, distinct, and non-repetitive suggestions for significant improvements.

IMPORTANT:
You must NEVER suggest changes that span across different diff hunks.
Your suggestions should be strictly confined within a single hunk.

Review Criteria:

1. Purpose and Design: Evaluate how well the code fulfills its intended purpose. Does it align with the overall system design and business requirements?
2. Code Structure and Readability: Assess the overall structure, modularity, and readability of the code. Is it easy to understand?
3. Functionality and Logic: Identify any significant logic errors or bugs that could cause the code to malfunction or produce incorrect results. Focus on issues that impact core functionality.
4. Performance and Scalability: Highlight any design choices or implementations that could lead to significant performance issues or limit the application's ability to scale, especially in critical paths.
5. Security and Data Integrity: Flag any clear vulnerabilities that could lead to security risks or compromise data integrity. Focus on issues with potentially severe consequences.
6. Error Handling and Robustness: Ensure that critical errors and exceptions are properly caught and handled to prevent system crashes or data loss. Consider the overall error handling strategy rather than individual cases.
7. Code Reusability and DRY Principles: Identify opportunities for code reuse or refactoring that could significantly improve maintainability or reduce complexity.
8. Architectural Consistency: Address any violations of the project's core architectural principles that could lead to significant technical debt or maintainability issues.
9. Critical Documentation: Ensure that complex algorithms, critical business logic, or public APIs have adequate high-level documentation for maintainability and proper usage.
10. Compliance and Standards: Flag any code that clearly violates legal, regulatory, or important project-specific standards. Focus on significant violations rather than minor infractions.

Review Guidelines:

1. Focus on Impact and Context:
  - Prioritize feedback on issues with the most significant impact on functionality, maintainability, and overall quality.
  - Consider the context and purpose of the code when providing feedback.
  - Be more relaxed with minor issues and concentrate on critical problems.

2. Constructive and Balanced Feedback:
  - Provide constructive feedback that identifies issues and suggests improvements or alternatives.
  - Balance pointing out problems with acknowledging good practices or clever solutions.
  - Offer actionable suggestions based on the criteria, avoiding repetitive phrases like "Consider" or "You should".

3. Code Organization and Readability:
  - Suggest code extraction only if it significantly enhances readability or reusability.
  - Only one comment is allowed per line, rollup comments for the same line into a single comment.

4. Review Scope and Boundaries:
  - The line numbers are prefixed on each line.
  - Only consider lines that were modified, such as ones beginning with "+" or "-".
  - Only offer suggestions within the specified line ranges of a single hunk.
  - Never span suggestions across different blocks or ranges.
  - Focus on critical issues, ignoring minor details, formatting differences, and incomplete code at range boundaries.
  - Ignore missing imports and don't make assumptions about undefined variables or unused code.
  - Consider suggestions holistically, understand their impact and intent.

5. Formatting and Presentation:
  - Ensure line numbers are accurate and align with the provided diff hunks.
  - Use {RESPONSE_SEPARATOR} only as a separator between suggestions.
  - Do not create multi-line comments that span across different specified line ranges.
  - Do not use markdown directly in the "body" field; use the special delimiter as shown.
  - Omit the "action" field if no code change (suggestion) was provided.
  - Provide the "action" field that matches with your intent for a code change: "replace" or "remove".
  - Here is an example of how to suggest code changes instead of using markdown directly in the "body" field:
    ==__CODE_SUGGESTION__==function test() { return true; }==__CODE_SUGGESTION__==

------

**Response Format:**
- Adhere strictly to the format below.
- Do not include any additional text in your response.
- Ensure line numbers are accurate.

**Fields Explanation:**
- "start_line": Starting line of the comment
- "end_line": Ending line for multi-line comments (omit for single-line comments)
- "body": The suggested comment (can include text or markdown)
- "action": If code suggestions are provided, also provide the desired action: "replace" or "remove"

**Critical Rules:**
- **The "start_line" must always precede the "end_line" in multi-line suggestions.**
- **Ensure that "start_line" and "end_line" are within the same code block.**
- Never suggest changes that span across different code blocks.

Consider you had the following hunks: 10-14, 20-29, 71-74

Example of INVALID response (DO NOT DO THIS):
{RESPONSE_SEPARATOR}
start_line: 12
end_line: 24
body: This suggestion is invalid because it spans across different commit ranges (10-14 and 20-29).

Example of VALID responses:
{RESPONSE_SEPARATOR}
start_line: 10
end_line: 14
body: This suggestion is valid because it's entirely within the 10-14 commit range.
{RESPONSE_SEPARATOR}
start_line: 22
end_line: 25
body: This suggestion is also valid because it's entirely within the 20-29 commit range.
{RESPONSE_SEPARATOR}
start_line: 71
end_line: 71
body: Example of how to give code examples ==__CODE_SUGGESTION__==function test() { return true; }==__CODE_SUGGESTION__==
action: "replace"`.replaceAll("{RESPONSE_SEPARATOR}", REVIEW_SEPARATOR),
					},
				],
			}),
			new HumanMessage({
				content: [
					{
						type: "text",
						text: `Review the following file and diff:
File:
${fileDetails.file}

Diff:
${fileDetails.diff}`,
					},
				],
			}),
		]);

		const comments = this.parseSuggestions(
			fileDetails.file,
			reviewResponse.content.toString()
		);

		const absoluteUri = vscode.Uri.joinPath(
			vscode.Uri.parse(this._workspace),
			fileDetails.file
		);

		return {
			file: fileDetails.file,
			diff: fileDetails.diff,
			original: await this.diffGenerator.getOriginalContent(
				fileDetails.file
			),
			current: await vscode.workspace.fs
				.readFile(absoluteUri)
				.then((buffer) => buffer.toString()),
			comments,
		};
	}

	parseSuggestions(file: string, input: string): CodeReviewComment[] {
		const comments: CodeReviewComment[] = [];
		const blocks = input.trim().split(REVIEW_SEPARATOR);

		for (const block of blocks) {
			if (block.trim() === "") continue; // Skip empty blocks

			const startLineMatch = block.match(/start_line:\s*(\d+|null)/);
			const endLineMatch = block.match(/end_line:\s*(\d+)/);
			const bodyMatch = block.match(/body:\s*([\s\S]*?)(?=\naction:|$)/);
			const actionMatch = block.match(/action:\s*([^\n]+)/);

			if (bodyMatch) {
				let body = bodyMatch[1].trim();
				let code;

				const codeBlockMatch = body.match(
					/==__CODE_SUGGESTION__==([\s\S]*?)==__CODE_SUGGESTION__==/
				);
				if (codeBlockMatch) {
					code = `\`\`\`${getLanguageFromFile(
						file
					)}\n${codeBlockMatch[1].trim()}\n\`\`\``;
					body = body.replace(codeBlockMatch[0], "").trim();
				}

				let endLine;
				if (endLineMatch) {
					const line = parseInt(endLineMatch[1], 10);
					if (!isNaN(line)) {
						endLine = line;
					}
				}

				let startLine;
				if (startLineMatch) {
					const start_line = parseInt(startLineMatch[1], 10);
					if (!isNaN(start_line)) {
						startLine = start_line;
					}
				}

				let action: CodeCommentAction;
				if (actionMatch) {
					action = actionMatch[1].trim() as CodeCommentAction;
				}

				comments.push({
					body,
					code: code || "",
					startLine: startLine ?? 0,
					endLine,
					action,
				});
			}
		}

		return comments;
	}
}

const getLanguageFromFile = (filePath: string): string => {
	const extension = filePath.split(".").pop()?.toLowerCase() || "";

	const languageMap: Record<string, string> = {
		// JavaScript/TypeScript family
		ts: "typescript",
		tsx: "tsx",
		cts: "typescript",
		mts: "typescript",
		js: "javascript",
		jsx: "jsx",
		cjs: "javascript",
		mjs: "javascript",
		"d.ts": "typescript",

		// Web technologies
		html: "html",
		htm: "html",
		css: "css",
		scss: "scss",
		sass: "sass",
		less: "less",
		vue: "vue",
		svelte: "svelte",

		// Backend languages
		py: "python",
		rb: "ruby",
		php: "php",
		java: "java",
		cs: "csharp",
		go: "go",
		rs: "rust",
		swift: "swift",
		kt: "kotlin",
		kts: "kotlin",
		scala: "scala",
		clj: "clojure",
		coffee: "coffeescript",
		elm: "elm",
		erl: "erlang",
		fs: "fsharp",
		fsx: "fsharp",
		gradle: "gradle",
		groovy: "groovy",
		hs: "haskell",
		lua: "lua",
		pl: "perl",
		r: "r",

		// C/C++ family
		cpp: "cpp",
		cc: "cpp",
		cxx: "cpp",
		c: "c",
		h: "c",
		hpp: "cpp",
		hxx: "cpp",

		// Data/Config formats
		json: "json",
		jsonc: "jsonc",
		yaml: "yaml",
		yml: "yaml",
		toml: "toml",
		xml: "xml",
		csv: "csv",

		// Shell/Scripts
		sh: "shellscript",
		bash: "shellscript",
		zsh: "shellscript",
		fish: "shellscript",
		ps1: "powershell",
		psm1: "powershell",
		bat: "bat",
		cmd: "bat",

		// Documentation
		md: "markdown",
		mdx: "mdx",
		tex: "latex",
		rst: "restructuredtext",
		asciidoc: "asciidoc",
		adoc: "asciidoc",

		// Database
		sql: "sql",
		mysql: "sql",
		pgsql: "sql",
		plsql: "plsql",

		// Other
		dockerfile: "dockerfile",
		graphql: "graphql",
		prisma: "prisma",
		proto: "protobuf",
	};

	// Handle files without extensions (like Dockerfile)
	const fileName = filePath.split("/").pop()?.toLowerCase() || "";
	if (fileName === "dockerfile") return "dockerfile";
	if (fileName === "makefile") return "makefile";
	if (fileName === "jenkinsfile") return "groovy";

	return languageMap[extension] || "plaintext";
};
