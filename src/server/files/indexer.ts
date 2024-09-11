import { fileURLToPath } from "url";
import type { Document } from "@langchain/core/documents";
import type {
	CodeGraph,
	CodeGraphNode,
	SkeletonizedCodeGraphNode,
} from "./graph";
import type { CodeParser } from "./parser";
import {
	convertIdToFilePath,
	convertIdToFileUri,
	getTextDocumentFromUri,
} from "./utils";
import { type Generator } from "./generator";
import {
	DocumentSymbol,
	Location,
	Position,
	Range,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SerializeMap } from "../../store/vector";
import { createCodeNode } from "./graph";

export type IndexerResult = {
	codeDocs: Document[];
	relativeImports: SerializeMap;
	relativeExports: SerializeMap;
};

export class Indexer {
	constructor(
		private readonly directory: string,
		private readonly codeParser: CodeParser,
		private readonly codeGraph: CodeGraph,
		private readonly generator: Generator
	) {}

	addDocumentToCodeGraph = async (
		fileUri: string,
		symbols: DocumentSymbol[]
	): Promise<string[]> => {
		let nodeIds: string[] = [];
		const textDocument = await getTextDocumentFromUri(fileUri);
		if (!textDocument) {
			return nodeIds;
		}

		if (symbols.length === 0) {
			const symbolText = textDocument.getText();

			// calculate the last line and last character of the document
			const lastLine = textDocument.lineCount - 1;
			const lastCharacter = symbolText.split("\n")?.pop()?.length || 0;

			const node = createCodeNode(
				Location.create(
					textDocument.uri,
					Range.create(
						Position.create(0, 0),
						Position.create(lastLine, lastCharacter)
					)
				)
			);

			this.codeGraph.addNode(node);
			nodeIds.push(node.id);
			return nodeIds;
		}

		for (const symbol of symbols) {
			const { node, extractedCodeNodes } =
				await this.codeParser.processSymbol(textDocument, symbol);

			this.codeGraph.addNode(node);
			nodeIds.push(node.id);

			for (const extractedCodeNode of extractedCodeNodes) {
				const externalFileUri = convertIdToFileUri(
					extractedCodeNode.id,
					extractedCodeNode.location.range.start.line.toString(),
					extractedCodeNode.location.range.start.character.toString()
				);

				if (externalFileUri !== fileUri) {
					await this.addDocumentToCodeGraph(
						externalFileUri,
						await this.codeParser.getDocumentSymbols(
							externalFileUri
						)
					);
				}
				this.codeGraph.addNode(extractedCodeNode);
				this.codeGraph.addImportEdge(
					fileURLToPath(node.id).replace(this.directory, ""),
					extractedCodeNode.id
				);
			}

			await this.codeParser.processChildSymbols(
				textDocument,
				node,
				symbol
			);
		}

		return nodeIds;
	};

	async skeletonizeCodeNodes(nodes: CodeGraphNode[]) {
		const textDocumentCache = new Map<string, TextDocument>();
		const parentNodeMap = new Map<string, CodeGraphNode[]>();
		const rootNodes: CodeGraphNode[] = [];
		const skeletonNodes: SkeletonizedCodeGraphNode[] = [];

		for (const node of nodes) {
			if (node.parentNodeId) {
				parentNodeMap.set(node.parentNodeId, [
					...(parentNodeMap.get(node.parentNodeId) || []),
					node,
				]);
			} else {
				rootNodes.push(node);
			}
		}

		const processNode = async (
			node: CodeGraphNode,
			textDocumentCache: Map<string, TextDocument>
		): Promise<void> => {
			const childNodes = parentNodeMap.get(node.id) || [];
			await Promise.all(
				childNodes.map((c) => processNode(c, textDocumentCache))
			);
			const skeletonNode = await this.skeletonizeNode(
				node,
				childNodes,
				textDocumentCache
			);
			if (skeletonNode) {
				skeletonNodes.push(skeletonNode);
			}
		};

		for (const node of rootNodes) {
			await processNode(node, textDocumentCache);
		}

		return skeletonNodes;
	}

	private async skeletonizeNode(
		node: CodeGraphNode,
		childNodes: CodeGraphNode[] = [],
		textDocumentCache: Map<string, TextDocument>
	) {
		const relatedNodeEdges =
			this.codeGraph.getImportEdge(node.id) || new Set<string>();

		let textDocument: TextDocument | undefined;
		if (textDocumentCache.has(node.location.uri)) {
			textDocument = textDocumentCache.get(node.location.uri);
		} else {
			textDocument = await getTextDocumentFromUri(node.location.uri);
			if (textDocument) {
				textDocumentCache.set(node.location.uri, textDocument);
			}
		}

		if (!textDocument) {
			return undefined;
		}

		const filePath = fileURLToPath(node.location.uri);
		let nodeCodeBlock = textDocument.getText(node.location.range);

		if (childNodes.length > 0) {
			nodeCodeBlock = this.codeParser.mergeCodeNodeSummariesIntoParent(
				node.location,
				nodeCodeBlock,
				childNodes.map((n) => n.id)
			);
		}

		const relatedNodes = Array.from(relatedNodeEdges)
			.map((edge) => this.codeGraph.getNode(edge))
			.filter((e): e is CodeGraphNode => !!e);

		const skeletonNode = await this.generator.skeletonizeCodeGraphNode(
			filePath,
			node,
			nodeCodeBlock,
			textDocumentCache,
			relatedNodes
		);

		this.codeGraph.addSkeletonNode(skeletonNode);

		return skeletonNode;
	}

	async embedCodeGraph(
		skeletonNodes: SkeletonizedCodeGraphNode[]
	): Promise<IndexerResult> {
		const codeDocs: Document[] = [];
		for (const skeletonNode of skeletonNodes) {
			const relatedNodes = Array.from(
				this.codeGraph.getImportEdge(skeletonNode.id) || []
			);

			const filePath = convertIdToFilePath(
				skeletonNode.id,
				skeletonNode.location.range.start.line.toString(),
				skeletonNode.location.range.start.character.toString(),
				this.directory
			);
			const startRange = `${skeletonNode.location.range.start.line}-${skeletonNode.location.range.start.character}`;
			const document: Document = {
				pageContent: skeletonNode.skeleton,
				id: skeletonNode.id,
				metadata: {
					//Strip Id parts to just the file path
					filePath: !filePath.startsWith("/")
						? filePath
						: filePath.slice(1),
					startRange,
					endRange: `${skeletonNode.location.range.end.line}-${skeletonNode.location.range.end.character}`,
					relatedNodes: relatedNodes.map((nodeId) =>
						fileURLToPath(nodeId).replace(this.directory, "")
					),
					parentNodeId: skeletonNode.parentNodeId,
				},
			};
			codeDocs.push(document);
		}

		const convertNodeId = (id: string) => {
			if (id.startsWith("file://")) {
				return fileURLToPath(id).replace(this.directory, "");
			}
			return id;
		};

		const relativeImports = Array.from(this.codeGraph.getImportEdges()).map(
			([key, value]) => [
				convertNodeId(key),
				Array.from(value).map(convertNodeId),
			]
		);
		const relativeExports = Array.from(this.codeGraph.getExportEdges()).map(
			([key, value]) => [
				convertNodeId(key),
				Array.from(value).map(convertNodeId),
			]
		);

		return {
			codeDocs,
			//@ts-expect-error
			relativeImports,
			//@ts-expect-error
			relativeExports,
		};
	}
}
