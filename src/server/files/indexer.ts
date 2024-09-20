import { fileURLToPath } from "url";
import type { Document } from "@langchain/core/documents";
import type {
	CodeGraph,
	CodeGraphEdgeMap,
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
import { SerializeMap, Store } from "../../store/vector";
import { createCodeNode } from "./graph";
import path from "node:path";
import { SymbolRetriever } from "../retriever";
import { createHash } from "node:crypto";

export type IndexerResult = {
	codeDocs: Document[];
	relativeImports: SerializeMap;
	relativeExports: SerializeMap;
};

async function getFileFromSymbolTable(
	currentDocument: string,
	workspace: string,
	codeGraph: CodeGraph
) {
	const textDocument = await getTextDocumentFromUri(currentDocument);
	const documentText = textDocument!.getText();
	const documentHash = createHash("sha256")
		.update(documentText)
		.digest("hex");
	const relativeFilePath = path.relative(
		workspace,
		fileURLToPath(currentDocument)
	);
	const exisitngFile = codeGraph.getFileFromSymbolTable(relativeFilePath);

	return { file: exisitngFile, relativeFilePath, sha: documentHash };
}

export class Indexer {
	private syncing: boolean = false;

	constructor(
		private readonly workspace: string,
		private readonly codeParser: CodeParser,
		private readonly codeGraph: CodeGraph,
		private readonly generator: Generator,
		private readonly symbolRetriever: SymbolRetriever,
		private readonly vectorStore: Store
	) {}

	isSyncing = () => this.syncing;

	processDocuments = async (documentUris: string[], fullBuild = false) => {
		if (!this.workspace || !documentUris || documentUris.length === 0) {
			console.log(
				"Skipping indexing",
				this.workspace,
				documentUris?.length
			);
			this.syncing = false;
			return;
		}
		this.syncing = true;
		const fileHashMap: Map<string, string> = new Map();
		const alreadyVisited = new Set<string>();

		console.log(`Processing ${documentUris.length} documents`);

		for (const documentUri of documentUris) {
			try {
				if (alreadyVisited.has(documentUri)) {
					continue;
				}

				console.log("Adding document to graph: " + documentUri);
				const relatedNodes: Set<string> = new Set([documentUri]);
				const nodesToProcess: Map<string, CodeGraphNode> = new Map();

				for (const currentDocument of relatedNodes.values()) {
					if (alreadyVisited.has(currentDocument)) {
						continue;
					}
					alreadyVisited.add(currentDocument);

					const { file, relativeFilePath, sha } =
						await getFileFromSymbolTable(
							currentDocument,
							this.workspace,
							this.codeGraph
						);

					// Since file invalidation has a blast radius of associated files, we need to check if the file has already been indexed
					// Or if the file is being indexed in this current job
					if (
						file &&
						(file.sha === sha ||
							fileHashMap.get(relativeFilePath) === sha)
					) {
						console.log("File already indexed: " + currentDocument);
						continue;
					}

					const symbols = await this.symbolRetriever?.getSymbols(
						currentDocument
					);

					const { importEdges, exportEdges, nodes } =
						(await this.createNodesFromDocument(
							currentDocument,
							symbols || []
						)) || {
							importEdges: new Map() as CodeGraphEdgeMap,
							exportEdges: new Map() as CodeGraphEdgeMap,
							nodes: new Map() as Map<string, CodeGraphNode>,
						};

					if (nodes.size === 0) {
						return;
					}

					const nodeIdsForFile = new Set<string>();
					for (const node of nodes.values()) {
						if (node.location.uri !== currentDocument) {
							const { file, relativeFilePath, sha } =
								await getFileFromSymbolTable(
									node.location.uri,
									this.workspace,
									this.codeGraph
								);

							if (
								file &&
								(file.sha === sha ||
									fileHashMap.get(relativeFilePath) === sha)
							) {
								console.log(
									"File already indexed: " + node.location.uri
								);
								continue;
							}

							relatedNodes.add(node.location.uri);
						} else {
							nodesToProcess.set(node.id, node);
						}
					}

					fileHashMap.set(relativeFilePath, sha);
					this.codeGraph?.addOrUpdateFileInSymbolTable(
						relativeFilePath,
						{
							nodeIds: nodeIdsForFile,
							sha: sha,
						}
					);

					this.codeGraph?.mergeImportEdges(importEdges);
					this.codeGraph?.mergeExportEdges(exportEdges);
				}

				const skeletonNodes = await this.skeletonizeCodeNodes(
					Array.from(nodesToProcess.values())
				);

				if (skeletonNodes?.length) {
					const indexerResult = await this.embedCodeGraph(
						skeletonNodes
					);

					if (!indexerResult) {
						return;
					}

					const { codeDocs, relativeImports, relativeExports } =
						indexerResult;
					await this.vectorStore?.save(
						codeDocs,
						relativeImports,
						relativeExports,
						this.codeGraph?.getSymbolTable() || new Map(),
						!fullBuild
					);

					console.log("Graph saved: " + codeDocs.length);
				}
			} catch (error) {
				if (error instanceof Error) {
					console.error(
						`Error processing document queue for ${documentUri}: ${error.message}`,
						error
					);
				}
			}
		}

		this.syncing = false;
	};

	createNodesFromDocument = async (
		fileUri: string,
		symbols: DocumentSymbol[]
	) => {
		const importEdges: CodeGraphEdgeMap = new Map();
		const exportEdges: CodeGraphEdgeMap = new Map();
		const nodes: Map<string, CodeGraphNode> = new Map();

		const textDocument = await getTextDocumentFromUri(fileUri);
		if (!textDocument) {
			return { nodes, importEdges, exportEdges };
		}
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
						Position.create(lastLine, lastCharacter)
					)
				)
			);

			nodes.set(node.id, node);
			return { nodes, importEdges, exportEdges };
		}

		for (const symbol of symbols) {
			const { node, extractedCodeNodes } =
				await this.codeParser.processSymbol(textDocument, symbol);

			nodes.set(node.id, node);

			for (const extractedCodeNode of extractedCodeNodes) {
				nodes.set(extractedCodeNode.id, extractedCodeNode);
				if (node.id !== extractedCodeNode.id) {
					if (importEdges.has(node.id)) {
						importEdges.get(node.id)?.add(extractedCodeNode.id);
					} else {
						importEdges.set(
							node.id,
							new Set<string>().add(extractedCodeNode.id)
						);
					}
				}
			}

			const childNodes = await this.codeParser.processChildSymbols(
				textDocument,
				node,
				symbol,
				importEdges,
				exportEdges
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
				textDocumentCache,
				skeletonNodes
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
		textDocumentCache: Map<string, TextDocument>,
		skeletonNodes: SkeletonizedCodeGraphNode[] = []
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
				childNodes.map((n) => n.id),
				skeletonNodes
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
				this.workspace
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
						path.relative(this.workspace, fileURLToPath(nodeId))
					),
					parentNodeId: skeletonNode.parentNodeId,
				},
			};
			codeDocs.push(document);
		}

		const convertNodeId = (id: string) => {
			if (id.startsWith("file://")) {
				return path.relative(this.workspace, fileURLToPath(id));
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
