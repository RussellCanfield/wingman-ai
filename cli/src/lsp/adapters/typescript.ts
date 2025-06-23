import { pathToFileURL } from "node:url";
import type { LspManager } from "../manager";

export const registerTypescriptAdapter = async (
	manager: LspManager,
	projectRoot: string,
) => {
	const tsserverPath = require.resolve(
		"typescript-language-server/lib/cli.mjs",
	);

	const rootUri = pathToFileURL(projectRoot).toString();

	return manager.addClient(
		"typescript",
		"node",
		[tsserverPath, "--stdio"],
		{
			workspace: {
				symbol: {
					symbolKind: {
						valueSet: [
							1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
							20, 21, 22, 23, 24, 25, 26,
						],
					},
				},
				workspaceFolders: true,
				configuration: true,
			},
			textDocument: {
				typeDefinition: {
					dynamicRegistration: true,
					linkSupport: true,
				},
				hover: {
					dynamicRegistration: true,
					contentFormat: ["plaintext", "markdown"],
				},
				references: {
					dynamicRegistration: true,
				},
				documentSymbol: {
					dynamicRegistration: true,
					hierarchicalDocumentSymbolSupport: true,
				},
				publishDiagnostics: {
					relatedInformation: true,
					codeDescriptionSupport: true,
				},
			},
		},
		{
			tsserver: {
				useSyntaxServer: "never",
			},
			preferences: {
				disableSuggestions: true,
				includeCompletionsForImportStatements: false,
				includeCompletionsForModuleExports: false,
				includeCompletionsWithSnippetText: false,
				includeCompletionsWithInsertText: false,
				includeAutomaticOptionalChainCompletions: false,
				includeCompletionsWithClassMemberSnippets: false,
				includeCompletionsWithObjectLiteralMethodSnippets: false,
				useLabelDetailsInCompletionEntries: false,
				allowTextChangesInNewFiles: false,
				organizeImportsNumericCollation: false,
			},
		},
		rootUri,
		"typescript",
	);
};
