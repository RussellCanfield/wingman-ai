import {
	type DocumentSymbol,
	Location,
	Position,
	Range,
	SymbolKind,
} from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { SgNode, js as astGrep } from "@ast-grep/napi";
import { filterSystemLibraries, getTextDocumentFromUri } from "./utils";
import type { SymbolRetriever } from "../retriever";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export type CodeGraphNode = {
	id: string;
	location: Location;
	parentNodeId?: string;
};

export type SkeletonizedCodeGraphNode = {
	skeleton: string;
} & CodeGraphNode;

export type CodeGraphEdgeMap = Map<string, Set<string>>;

async function loadAstGrepBinding() {
	try {
		const { js } = await import("@ast-grep/napi");
		if (!js) {
			console.error("js is undefined after importing @ast-grep/napi");
		}
		return js;
	} catch (error) {
		console.error("Error importing @ast-grep/napi:", error);
		throw error;
	}
}

export class CodeParser {
	private js: typeof astGrep | undefined;

	constructor(
		private readonly workspace: string,
		private readonly symbolRetriever: SymbolRetriever,
	) {}

	async initialize() {
		this.js = await loadAstGrepBinding();
	}

	async getDocumentSymbols(textDocumentUri: string): Promise<DocumentSymbol[]> {
		return this.symbolRetriever.getSymbols(textDocumentUri);
	}

	async processSymbol(textDocument: TextDocument, symbol: DocumentSymbol) {
		const symbolText = textDocument.getText(symbol.range);

		const node = createCodeNode(
			Location.create(textDocument.uri, symbol.range),
		);

		const referencedSymbols = this.findReferencedSymbols(symbolText);
		const extractedCodeNodes = await this.extractExternalCodeNodes(
			textDocument,
			symbol.selectionRange,
			referencedSymbols ?? [],
		);

		return {
			node,
			extractedCodeNodes,
		};
	}

	async processChildSymbols(
		textDocument: TextDocument,
		parentCodeNode: CodeGraphNode,
		parentSymbol: DocumentSymbol,
		importEdges: CodeGraphEdgeMap,
		exportEdges: CodeGraphEdgeMap,
	): Promise<CodeGraphNode[]> {
		const nodes: CodeGraphNode[] = [];
		if (!parentSymbol.children) {
			return nodes;
		}

		for await (const child of parentSymbol.children) {
			if (!isMethod(child)) {
				continue;
			}

			const { node: childNode, extractedCodeNodes } = await this.processSymbol(
				textDocument,
				child,
			);

			childNode.parentNodeId = parentCodeNode.id;
			nodes.push(childNode);

			for (const extractedCodeNode of extractedCodeNodes) {
				nodes.push(extractedCodeNode);

				if (childNode.id !== extractedCodeNode.id) {
					if (importEdges.has(childNode.id)) {
						importEdges.get(childNode.id)?.add(extractedCodeNode.id);
					} else {
						importEdges.set(
							childNode.id,
							new Set<string>().add(extractedCodeNode.id),
						);
					}
				}

				if (extractedCodeNode.id !== childNode.id) {
					if (exportEdges.has(extractedCodeNode.id)) {
						exportEdges.get(extractedCodeNode.id)?.add(childNode.id);
					} else {
						exportEdges.set(
							extractedCodeNode.id,
							new Set<string>().add(childNode.id),
						);
					}
				}
			}
		}

		return nodes;
	}

	// This is not perfect, but it's a good start
	mergeCodeNodeSummariesIntoParent(
		parentNodeLocation: Location,
		parentCodeBlock: string,
		relatedNodeEdgeIds: string[],
		skeletonNodes: SkeletonizedCodeGraphNode[],
	) {
		let codeBlock = parentCodeBlock;
		for (const childNodeId of relatedNodeEdgeIds) {
			const childNode = skeletonNodes.find((n) => n.id === childNodeId);

			if (!childNode) {
				continue;
			}

			codeBlock = this.replaceLineRange(
				codeBlock,
				childNode.location.range.start.line -
					parentNodeLocation.range.start.line,
				childNode.location.range.end.line - parentNodeLocation.range.start.line,
				[childNode.skeleton],
			);
		}

		return codeBlock;
	}

	private replaceLineRange(
		input: string,
		startLine: number,
		endLine: number,
		newLines: string[],
	): string {
		const lines = input.split("\n");
		if (lines.length === 1) {
			lines.push(...newLines);
		} else {
			lines.splice(startLine, endLine - startLine + 1, ...newLines);
		}
		return lines.join("\n");
	}

	private async extractExternalCodeNodes(
		textDocument: TextDocument,
		symbolDefRange: Range,
		referencedSymbols: SgNode[],
	): Promise<CodeGraphNode[]> {
		const matchedSymbols: Map<string, CodeGraphNode> = new Map();

		// Cache text documents to avoid reopening them
		const documentCache: Map<string, TextDocument> = new Map();

		// Helper function to get text document, with caching
		const getCachedDocument = async (
			uri: string,
		): Promise<TextDocument | undefined> => {
			if (!documentCache.has(uri)) {
				const doc = await getTextDocumentFromUri(uri);
				if (doc) {
					documentCache.set(uri, doc);
				}
			}
			return documentCache.get(uri);
		};

		const matchesPromises = referencedSymbols.map(async (refSymbol) => {
			if (!refSymbol) {
				return [];
			}
			try {
				const refSymbolRange = refSymbol.range();
				const symbolPosition = Position.create(
					symbolDefRange.start.line + refSymbolRange.start.line,
					refSymbolRange.start.column,
				);
				const [def, typeDef] = await Promise.all([
					this.symbolRetriever.getDefinition(
						textDocument.uri.toString(),
						symbolPosition,
					),
					this.symbolRetriever.getTypeDefinition(
						textDocument.uri.toString(),
						symbolPosition,
					),
				]);
				const matches = filterSystemLibraries([
					...(def || []),
					...(typeDef || []),
				]).filter(
					(loc, index, self) =>
						index ===
							self.findIndex(
								(t) =>
									t.uri === loc.uri &&
									t.range.start.line === loc.range.start.line,
							) && loc.uri.startsWith("file://"),
				);
				// .filter(
				// 	(loc) =>
				// 		!(
				// 			loc.uri === textDocument.uri &&
				// 			loc.range.start.line >=
				// 				symbolRange.start.line &&
				// 			loc.range.end.line <= symbolRange.end.line
				// 		)
				// );
				return matches;
			} catch (error) {
				console.error(error);
				return [];
			}
		});

		const allMatches = (await Promise.all(matchesPromises)).flat();

		for (const match of allMatches) {
			if (
				Array.from(matchedSymbols.values()).some(
					(node) =>
						match.range.start.line > node.location.range.start.line &&
						match.range.end.line < node.location.range.end.line,
				)
			) {
				continue;
			}

			try {
				const matchDoc =
					match.uri !== textDocument.uri
						? await getCachedDocument(match.uri)
						: textDocument;

				if (!matchDoc) {
					continue;
				}

				const symbols = await this.symbolRetriever.getSymbols(matchDoc.uri);
				const matchedSymbol = symbols.find(
					(s) =>
						//This is done explicitly to prevent keywords getting in the way (ex: export)
						s.selectionRange.start.line === match.range.start.line,
				);

				if (matchedSymbol) {
					const codeNode = createCodeNode(
						Location.create(match.uri, matchedSymbol.range),
					);
					if (!matchedSymbols.has(codeNode.id)) {
						matchedSymbols.set(codeNode.id, codeNode);
					}
				}
			} catch (error) {
				console.error("Failed to process match", error);
			}
		}

		return Array.from(matchedSymbols.values());
	}

	private findReferencedSymbols(codeBlock: string) {
		const ast = this.js?.parse(codeBlock);

		if (!ast) return;

		const root = ast.root();

		const stack = [root];
		const symbols: SgNode[] = [];

		while (stack.length > 0) {
			const node = stack.pop();

			if (node === undefined) {
				continue;
			}

			const nodeKind = node.kind();
			const nodeText = node.text();

			if (codeBlock !== nodeText) {
				//Covers:
				//JS/TS Arrow functions
				if (nodeKind === "variable_declarator") {
					symbols.push(node);
				} else if (nodeKind === "identifier") {
					symbols.push(node);
				} else if (nodeKind === "expression_statement") {
					symbols.push(node);
				} else if (nodeKind === "lexical_declaration") {
					const nodeChildren = node.children();

					if (nodeChildren.length >= 1) {
						const subNodeChildren = nodeChildren[1].children();

						if (subNodeChildren.length >= 2) {
							symbols.push(subNodeChildren[2]);
						}
					}
				}
			}

			stack.push(...node.children());
		}

		return symbols;
	}

	findImportStatements(codeBlock: string): SgNode[] {
		const ast = this?.js?.parse(codeBlock);

		if (!ast) return [];

		const root = ast.root();

		const importPatterns = [
			"import { $A } from '$B'",
			"import $A from '$B'",
			'import { $A } from "$B"',
			'import $A from "$B"',
			"import * as $A from '$B'",
			'import * as $A from "$B"',
			"import '$B'",
			'import "$B"',
			"const $A = require('$B')",
			'const $A = require("$B")',
			"var $A = require('$B')",
			'var $A = require("$B")',
			"let $A = require('$B')",
			'let $A = require("$B")',
		];

		const findImports = (root: SgNode, patterns: string[]): SgNode[] => {
			return patterns.flatMap((pattern) => root.findAll(pattern));
		};

		const allImports = findImports(root, importPatterns);

		// Use a Map to ensure unique nodes based on their range
		const uniqueImportsMap = new Map<string, SgNode>();

		for (const node of allImports) {
			const range = node.range();
			const key = `${range.start.line}:${range.start.column}`;
			if (!uniqueImportsMap.has(key)) {
				uniqueImportsMap.set(key, node);
			}
		}

		return Array.from(uniqueImportsMap.values());
	}

	createNodesFromDocument = async (textDocument: TextDocument) => {
		const importEdges: CodeGraphEdgeMap = new Map();
		const exportEdges: CodeGraphEdgeMap = new Map();
		const nodes: Map<string, CodeGraphNode> = new Map();

		const symbols = await this.symbolRetriever.getSymbols(textDocument.uri);

		const documentText = textDocument.getText();

		if (symbols.length === 0) {
			// calculate the last line and last character of the document
			const lastLine = textDocument.lineCount - 1;
			const lastCharacter = documentText.split("\n")?.pop()?.length || 0;

			const node = createCodeNode(
				Location.create(
					textDocument.uri,
					Range.create(
						Position.create(0, 0),
						Position.create(lastLine, lastCharacter),
					),
				),
			);

			nodes.set(node.id, node);
			return { nodes, importEdges, exportEdges };
		}

		for (const symbol of symbols) {
			const { node, extractedCodeNodes } = await this.processSymbol(
				textDocument,
				symbol,
			);

			nodes.set(node.id, node);

			for (const extractedCodeNode of extractedCodeNodes) {
				nodes.set(extractedCodeNode.id, extractedCodeNode);
				if (node.id !== extractedCodeNode.id) {
					const convertedNodeId = this.convertNodeId(node.id);
					const convertedExtractedId = this.convertNodeId(extractedCodeNode.id);

					if (importEdges.has(convertedNodeId)) {
						importEdges.get(convertedNodeId)?.add(convertedExtractedId);
					} else {
						importEdges.set(
							convertedNodeId,
							new Set<string>().add(convertedExtractedId),
						);
					}

					if (exportEdges.has(convertedExtractedId)) {
						exportEdges.get(convertedExtractedId)?.add(convertedNodeId);
					} else {
						exportEdges.set(
							convertedExtractedId,
							new Set<string>().add(convertedNodeId),
						);
					}
				}
			}

			const childNodes = await this.processChildSymbols(
				textDocument,
				node,
				symbol,
				importEdges,
				exportEdges,
			);

			for (const childNode of childNodes) {
				nodes.set(childNode.id, childNode);
			}
		}

		return {
			nodes,
			importEdges,
			exportEdges,
		};
	};

	convertNodeId(id: string) {
		// Find the last occurrence of '-' followed by numbers (line/char)
		const uriEndIndex = id.search(/-\d+-\d+$/);
		if (uriEndIndex === -1) {
			// Handle cases where the ID might not have line/char (though it should based on generation)
			// Or maybe it's already just a path/URI? Log or handle appropriately.
			console.warn(`Could not parse URI from node ID: ${id}`);
			// Attempt conversion anyway, or return a default/error
			try {
				return path.relative(this.workspace, fileURLToPath(id));
			} catch {
				return id; // Fallback or further error handling
			}
		}
		const uri = id.substring(0, uriEndIndex);
		try {
			const filePath = fileURLToPath(uri);
			return path.relative(this.workspace, filePath);
		} catch (e) {
			console.error(`Error converting URI ${uri} from node ID ${id}:`, e);
			return id; // Fallback or further error handling
		}
	}

	async retrieveCodeByPathAndRange(
		path: string,
		startLine: number,
		startCharacter: number,
		endLine: number,
		endCharacter: number,
	) {
		const textDocument = await getTextDocumentFromUri(
			pathToFileURL(path).toString(),
		);
		const codeBlock = textDocument?.getText(
			Range.create(
				Position.create(startLine, startCharacter),
				Position.create(endLine, endCharacter),
			),
		);

		return codeBlock;
	}
}

export function generateCodeNodeId(location: Location): string {
	return `${location.uri}-${location.range.start.line}-${location.range.start.character}`;
}

export function createCodeNode(location: Location): CodeGraphNode {
	return {
		id: generateCodeNodeId(location),
		location,
	};
}

export const isMethod = (symbol: DocumentSymbol) =>
	symbol.kind === SymbolKind.Method ||
	symbol.kind === SymbolKind.Function ||
	symbol.kind === SymbolKind.Constructor;
