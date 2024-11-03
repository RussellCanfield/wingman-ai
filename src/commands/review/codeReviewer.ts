import * as vscode from "vscode";
import { DiffGenerator } from "../../utils/diffGenerator";
import { DiffViewProvider } from "../../providers/diffViewProvider";
import { AIProvider } from "../../service/base";

export class CodeReviewer {
	private diffGenerator: DiffGenerator;

	constructor(
		private readonly _workspace: string,
		private readonly _aiProvider: AIProvider,
		private readonly _diffViewProvider: DiffViewProvider
	) {
		this.diffGenerator = new DiffGenerator(this._workspace);
	}

	async generateDiffsAndSummary(instructions: string) {
		try {
			const diffs = await this.diffGenerator.generateDiffs();
			const fileDiffMap = await this.buildFileDiffMap(diffs);

			if (fileDiffMap) {
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

Return you response using a GitHub markdown format.

-------

Here is additional information/instructions from the user to take into consideration:

${instructions || "None provided."}

-------

${Array.from(fileDiffMap)
	.map(([file, diff]) => {
		return `File: 
${file}

Changes:
${diff}
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

	private async buildFileDiffMap(diffs: string) {
		if (!diffs) {
			vscode.window.showInformationMessage(
				"No changes detected to review."
			);
			return;
		}

		// Parse the git diff output into a more manageable format
		const diffLines = diffs.split("\n");
		let currentFile = "";
		let changes: { [key: string]: string[] } = {};

		for (const line of diffLines) {
			if (line.startsWith("diff --git")) {
				// Extract the file path from diff --git a/path/to/file b/path/to/file
				currentFile = line.split(" ")[2].substring(2);
				changes[currentFile] = [];
			} else if (
				currentFile &&
				(line.startsWith("+") || line.startsWith("-"))
			) {
				changes[currentFile].push(line);
			}
		}

		const fileDiffMap = new Map<string, string>();
		for (const [file, fileChanges] of Object.entries(changes)) {
			if (fileChanges.length > 0) {
				const diffContent = await this.diffGenerator.showDiffForFile(
					file
				);
				fileDiffMap.set(file, diffContent);
			}
		}

		return fileDiffMap;
	}
}
