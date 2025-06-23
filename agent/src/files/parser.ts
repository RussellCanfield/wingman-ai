import {
	type DocumentSymbol,
	type Location,
	SymbolKind,
} from "vscode-languageserver";
import type { SymbolRetriever } from "./symbols";

export type FileRelationships = {
	imports: string[];
	exports: string[];
};

export class FileParser {
	constructor(
		private readonly workspace: string,
		private readonly symbolRetriever: SymbolRetriever,
	) {}

	async extractFileRelationships(fileUri: string): Promise<FileRelationships> {
		return {
			imports: [],
			exports: [],
		};
	}
}

export const isMethod = (symbol: DocumentSymbol) =>
	symbol.kind === SymbolKind.Method ||
	symbol.kind === SymbolKind.Function ||
	symbol.kind === SymbolKind.Constructor;

export function filterSystemLibraries(definitions: Location[]) {
	// Extended unwanted paths regex to include a generic Go's module cache path
	const unwantedPathsRegex =
		/node_modules|\.nuget|Assembly\/Microsoft|rustlib|rustc|rustup|rust-toolchain|rustup-toolchain|go\/pkg\/mod|\/go\/\d+(\.\d+)*\/|lib\/python\d+(\.\d+)*\/|site-packages|dist-packages/;

	return definitions.filter((def) => {
		const filePath = def.uri;
		// Use the regular expression to test for unwanted paths, including a generic Go library path
		return !unwantedPathsRegex.test(filePath);
	});
}
