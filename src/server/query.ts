import { Position, Range } from "vscode-languageserver/node";
import {
	CodeGraph,
	CodeGraphNode,
	generateCodeNodeIdFromParts,
	generateCodeNodeIdFromRelativePath,
} from "./files/graph";
import type { Document } from "@langchain/core/documents";
import path from "node:path";
import {
	filePathToUri,
	getTextDocumentFromPath,
	getTextDocumentFromUri,
} from "./files/utils";
import { fileURLToPath } from "node:url";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Store } from "../store/vector";

export class VectorQuery {
	retrieveDocumentsWithRelatedCodeFiles = async (
		query: string,
		codeGraph: CodeGraph,
		vectorStore: Store,
		workspace: string,
		maxDocuments = 10
	): Promise<Map<string, TextDocument>> => {
		const retrievedDocs = await vectorStore.retrieveDocuments(
			query,
			maxDocuments
		);

		return await this.retrieveRelatedCodeFiles(
			workspace,
			retrievedDocs,
			codeGraph
		);
	};

	retrieveDocumentsWithRelatedCode = async (
		query: string,
		codeGraph: CodeGraph,
		vectorStore: Store,
		workspace: string,
		maxDocuments = 10
	) => {
		const retrievedDocs = await vectorStore.retrieveDocuments(
			query,
			maxDocuments
		);

		const relatedCodeDocs = await this.retrieveRelatedCode(
			workspace,
			retrievedDocs,
			codeGraph
		);

		return {
			retrievedDocs,
			relatedCodeDocs,
		};
	};

	retrieveCodeByPathAndRange = async (
		path: string,
		startLine: number,
		startCharacter: number,
		endLine: number,
		endCharacter: number
	) => {
		const textDocument = await getTextDocumentFromUri(path);

		if (!textDocument) {
			return "";
		}

		const codeBlock = textDocument.getText(
			Range.create(
				Position.create(startLine, startCharacter),
				Position.create(endLine, endCharacter)
			)
		);

		return codeBlock;
	};

	retrieveRelatedCode = async (
		workspacePath: string,
		documents: Document[],
		codeGraph: CodeGraph
	) => {
		const codeBlocks: string[] = [];
		const processedRanges = new Set<string>();
		const textDocumentCache = new Map<string, TextDocument>();

		for await (const { metadata } of documents) {
			const {
				filePath: relativePath,
				startRange,
				endRange,
				relatedNodes: relatedNodeIdsString,
			} = metadata;

			const [startLine, startCharacter] = startRange.split("-");
			const [endLine, endCharacter] = endRange.split("-");

			const filePath = path.join(workspacePath, relativePath);
			const rangeKey = `${filePath}:${startLine}-${startCharacter}`;
			if (!processedRanges.has(rangeKey)) {
				let textDocument: TextDocument | undefined;
				if (textDocumentCache.has(filePath)) {
					textDocument = textDocumentCache.get(filePath);
				} else {
					textDocument = await getTextDocumentFromPath(filePath);

					if (textDocument) {
						textDocumentCache.set(filePath, textDocument);
					}
				}

				const codeBlock = textDocument?.getText(
					Range.create(
						Position.create(
							Number(startLine),
							Number(startCharacter)
						),
						Position.create(Number(endLine), Number(endCharacter))
					)
				);
				codeBlocks.push(`File: ${filePath}
Start Line: ${startLine}
Start Caharacter: ${startCharacter}
End Line: ${endLine}
End Character: ${endCharacter}

Code:
${codeBlock}`);
				processedRanges.add(rangeKey);
			}

			const docId = filePathToUri(path.join(workspacePath, filePath));
			const upstreamNodeIds =
				codeGraph.getExportEdge(
					generateCodeNodeIdFromParts(
						docId,
						startLine,
						startCharacter
					)
				) || new Set<string>();

			// This is not exhaustive, its only pulling one layer deep.
			// You could recursively pull in more related nodes if needed.
			// You could also pull the parent node Id.
			const relatedNodeIds = (relatedNodeIdsString as string[]).map(
				(id) => filePathToUri(path.join(filePath, id))
			);

			const relatedNodes = await Promise.all(
				[...relatedNodeIds, ...Array.from(upstreamNodeIds || [])].map(
					async (id) => {
						const node = codeGraph.getNode(id);
						return node ? node : null;
					}
				)
			);

			const relatedCodeBlocks = await Promise.all(
				relatedNodes
					.filter((n): n is CodeGraphNode => !!n)
					.map(async (node) => {
						const relatedFilePath = fileURLToPath(
							node.location.uri
						);
						const relatedRange = node.location.range;
						const relatedRangeKey = `${relatedFilePath}:${relatedRange.start.line}-${relatedRange.start.character}`;

						if (!processedRanges.has(relatedRangeKey)) {
							processedRanges.add(relatedRangeKey);

							let textDocument: TextDocument | undefined;
							if (textDocumentCache.has(filePath)) {
								textDocument = textDocumentCache.get(filePath);
							} else {
								textDocument = await getTextDocumentFromUri(
									filePath
								);

								if (textDocument) {
									textDocumentCache.set(
										filePath,
										textDocument
									);
								}
							}
							const codeBlock =
								textDocument?.getText(relatedRange);

							return `File: ${relatedFilePath}
Start Line: ${relatedRange.start.line}
End Line: ${relatedRange.end.line}

Code: 
${codeBlock}`;
						}
						return null;
					})
			);

			codeBlocks.push(
				...relatedCodeBlocks.filter(
					(block): block is string => block !== null
				)
			);
		}

		return codeBlocks;
	};

	retrieveRelatedCodeFiles = async (
		workspacePath: string,
		documents: Document[],
		codeGraph: CodeGraph
	) => {
		const processedRanges = new Set<string>();
		const textDocumentCache = new Map<string, TextDocument>();

		for await (const { metadata } of documents) {
			const {
				filePath: relativePath,
				startRange,
				relatedNodes: relatedNodeIdsString,
			} = metadata;

			const [startLine, startCharacter] = startRange.split("-");

			const filePath = path.join(workspacePath, relativePath);
			const rangeKey = `${startLine}-${startCharacter}`;
			if (!processedRanges.has(`${filePath}:${rangeKey}`)) {
				let textDocument: TextDocument | undefined;
				if (textDocumentCache.has(filePath)) {
					textDocument = textDocumentCache.get(filePath);
				} else {
					textDocument = await getTextDocumentFromPath(filePath);

					if (textDocument) {
						textDocumentCache.set(filePath, textDocument);
					}
				}
			}

			const nodeId = generateCodeNodeIdFromRelativePath(
				relativePath,
				startLine,
				startCharacter
			);
			const upstreamNodeIds =
				codeGraph.getExportEdge(nodeId) || new Set<string>();
			const downstreamNodeIds =
				codeGraph.getImportEdge(nodeId) || new Set<string>();

			// This is not exhaustive, its only pulling one layer deep.
			// You could recursively pull in more related nodes if needed.
			// You could also pull the parent node Id.
			const relatedNodeIds = (relatedNodeIdsString as string[]).map(
				(id) => filePathToUri(path.join(filePath, id))
			);

			const relatedNodes = await Promise.all(
				[
					...relatedNodeIds,
					...Array.from(upstreamNodeIds || []),
					...Array.from(downstreamNodeIds || []),
				].map(async (id) => {
					const node = codeGraph.getNode(id);
					return node ? node : null;
				})
			);

			const relatedCodeBlocks = await Promise.all(
				relatedNodes
					.filter((n): n is CodeGraphNode => !!n)
					.map(async (node) => {
						const relatedFilePath = fileURLToPath(
							node.location.uri
						);
						const relatedRange = node.location.range;
						const relatedRangeKey = `${relatedFilePath}:${relatedRange.start.line}-${relatedRange.start.character}`;

						if (!processedRanges.has(relatedRangeKey)) {
							processedRanges.add(relatedRangeKey);

							let textDocument: TextDocument | undefined;
							if (textDocumentCache.has(filePath)) {
								textDocument = textDocumentCache.get(filePath);
							} else {
								textDocument = await getTextDocumentFromUri(
									filePath
								);

								if (textDocument) {
									textDocumentCache.set(
										filePath,
										textDocument
									);
								}
							}
						}
						return null;
					})
			);
		}

		return textDocumentCache;
	};
}
