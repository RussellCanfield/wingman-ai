import { fileURLToPath } from "url";
import type { CodeGraphNode, SkeletonizedCodeGraphNode } from "./graph";
import type { CodeParser } from "./parser.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getTextDocumentFromUri } from "./utils";
import { AIProvider } from "../../service/base";

export class Generator {
	constructor(
		private readonly codeParser: CodeParser,
		private readonly aiProvider: AIProvider
	) {}

	public async generatorProjectSummary(
		configFileContents: string,
		language: string,
		dependencyFileName: string | null
	) {
		const prompt = `You are a senior developer analyzing a new project. 
Write a brief summary of the project based on the provided main configuration file.
The project is written in ${language}.

Instructions:
1. Focus on the project's purpose and goals.
2. Include key features and technologies used.
3. Avoid detailed implementation specifics.
4. Return your response in plain text, without markdown formatting.
5. If provided, use the dependency file name to enhance your response with which package manager is used.
6. Adapt your analysis based on the specific language and configuration file format.
7. Keep your response short and concise.

Response example:

This project appears to be a ${language} application that leverages:
- [List key technologies or frameworks]
- [Mention any significant libraries or tools]
- [Note any important development or build tools]

${dependencyFileName ? `Dependency file name: ${dependencyFileName}` : ""}

Main configuration file contents:

${configFileContents}`;

		const result = await this.aiProvider.invoke(prompt);

		return result.content.toString();
	}

	private async buildFileContents(
		filePath: string,
		codeBlock: string,
		textDocumentCache: Map<string, TextDocument>,
		externalCodeNodes?: CodeGraphNode[]
	) {
		const fileImports = await this.codeParser.findImportStatements(
			filePath
		);

		const fileText = `File: ${filePath}

${
	fileImports?.length === 0
		? ""
		: `
File Imports:
${fileImports.join("\n")}
`
}

Code Snippet:

${codeBlock}`;

		//group externalCodeNodes by location uri
		const externalCodeNodesByUri =
			externalCodeNodes?.reduce((acc, node) => {
				if (!acc.has(node.location.uri)) {
					acc.set(node.location.uri, [node]);
				} else {
					acc.get(node.location.uri)?.push(node);
				}
				return acc;
			}, new Map<string, CodeGraphNode[]>()) ||
			new Map<string, CodeGraphNode[]>();

		const codeFiles: string[] = [];
		for await (const [uri, nodes] of Array.from(externalCodeNodesByUri)) {
			const filePath = fileURLToPath(uri);
			if (!textDocumentCache.has(filePath)) {
				const doc = await getTextDocumentFromUri(uri);

				if (doc) {
					textDocumentCache.set(filePath, doc);
				}
			}
			const externalDoc = textDocumentCache.get(filePath);

			if (!externalDoc) {
				continue;
			}

			const nodeFileImports = await this.codeParser.findImportStatements(
				filePath
			);

			let externalFileText = `//File: ${filePath}

${nodeFileImports.join("\n")}`;

			for (const node of nodes) {
				externalFileText += `\n${externalDoc.getText(
					node.location.range
				)}`;
			}

			codeFiles.push(externalFileText);
		}

		return `${fileText}\n\n${codeFiles.join("\n")}`;
	}

	public async skeletonizeCodeGraphNode(
		filePath: string,
		codeNode: CodeGraphNode,
		codeBlock: string,
		textDocumentCache: Map<string, TextDocument>,
		externalCodeNodes: CodeGraphNode[]
	): Promise<SkeletonizedCodeGraphNode> {
		const fileContents = await this.buildFileContents(
			filePath,
			codeBlock,
			textDocumentCache,
			externalCodeNodes
		);

		const prompt = `You are an expert code reviewer. Analyze the given code snippet and any referenced external code to describe its purpose concisely.

Instructions:
1. Focus on the code's purpose, not implementation details.
2. Ignore import statements; use them only for context.
3. Preserve symbol declarations, but replace definitions with compreshensive functional descriptions.
4. Utilize external code references to enhance understanding when available.
5. Provide concise, direct descriptions without introductions.
6. Highlight patterns that may be relevant to the code's purpose or functionality.
7. Return the symbol with its description in plain text, without markdown formatting.
8. Try to develop a short and concise description the code may have in the context of the project.
9. If the file appears to be utility related, provide a brief description of the utility's purpose (ex: Configuration, Build Tools, Testing, etc.).

Format your response as follows:
[Symbol name]
// [Brief description of purpose]

Example:
export default App
// Main application component

const myVar = {
  // Configuration object for application settings
}

MyAmazingFunction = (param: string) => {
  // Processes input string and returns formatted result
}

class MyAmazingClass {
  // Manages user authentication and session handling
}

----

${fileContents}
`;

		const result = await this.aiProvider.invoke(prompt);

		return {
			id: codeNode.id,
			location: codeNode.location,
			skeleton: result.content.toString(),
		} satisfies SkeletonizedCodeGraphNode;
	}
}
