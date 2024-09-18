import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type { Document } from "@langchain/core/documents";
import {
	CodeGraph,
	CodeGraphNodeMap,
	createCodeNode,
	generateCodeNodeId,
	SymbolTable,
} from "../server/files/graph";
import { Location, Range } from "vscode-languageserver";
import { convertIdToFileUri } from "../server/files/utils";
import { LocalIndex } from "vectra";
import { EmbeddingsInterface } from "../service/embeddings/base";

export type SerializeMap = [string, string[]][];
export type SerializeTable = [string, { nodeIds: string[]; sha: string }][];

export type DocumentMetadata = {
	fileName: string;
	startLine: number;
	endLine: number;
};

export type VectorStoreSettings = {
	directory: string;
};

export class Store {
	directory: string;
	index: LocalIndex | undefined;

	constructor(
		private readonly workspace: string,
		private readonly embedder: EmbeddingsInterface
	) {
		const homeDir = os.homedir();
		this.directory = path.join(
			homeDir,
			".wingman",
			path.basename(this.workspace),
			"index"
		);
		this.index = new LocalIndex(this.directory);
		console.log("Vector store location:", this.directory);
	}

	createIndex = async () => {
		if (!(await this.index?.isIndexCreated())) {
			await this.index?.createIndex();
		}
	};

	initialize = async () => {
		if (!(await this.index?.isIndexCreated())) {
			return {
				store: this.index,
				codeGraph: new CodeGraph(new Map(), new Map(), new Map()),
			};
		}

		try {
			const stats = await this.index?.getIndexStats();
			console.log("Loaded store from disk", this.directory, stats?.items);

			let edgeDetails: {
				importEdges: SerializeMap;
				exportEdges: SerializeMap;
				symbolTable: SerializeTable;
			} = {
				importEdges: [],
				exportEdges: [],
				symbolTable: [],
			};

			try {
				edgeDetails = JSON.parse(
					await fs.promises.readFile(
						path.join(this.directory, "edges.json"),
						"utf-8"
					)
				);
			} catch (err) {
				console.error(
					"edges.json file not found or corrupt, proceeding with empty edges."
				);
				return {
					store: this.index,
					codeGraph: new CodeGraph(new Map(), new Map(), new Map()),
				};
			}

			const nodes: CodeGraphNodeMap = new Map();
			const items = await this.index?.listItems();
			for (const doc of items || []) {
				const { startRange, endRange } = doc.metadata;

				const [startLine, startCharacter] =
					String(startRange).split("-");
				const [endLine, endCharacter] = String(endRange).split("-");

				const location = Location.create(
					convertIdToFileUri(
						String(doc.id),
						startLine,
						startCharacter
					),
					Range.create(
						{
							line: Number(startLine),
							character: Number(startCharacter),
						},
						{
							line: Number(endLine),
							character: Number(endCharacter),
						}
					)
				);
				nodes.set(
					generateCodeNodeId(location),
					createCodeNode(location)
				);
			}

			const importEdges = new Map(
				edgeDetails.importEdges.map(([key, value]) => [
					key,
					new Set(value),
				])
			);

			const exportEdges = new Map(
				edgeDetails.exportEdges.map(([key, value]) => [
					key,
					new Set(value),
				])
			);

			const symbolTable = new Map(
				edgeDetails.symbolTable.map(([key, value]) => [
					key,
					{
						nodeIds: new Set(value.nodeIds),
						sha: value.sha,
					},
				])
			);

			return {
				store: this.index,
				codeGraph: new CodeGraph(
					nodes,
					exportEdges,
					importEdges,
					symbolTable
				),
			};
		} catch (e) {
			console.error("Error loading edges", e);
		}

		return {
			store: this.index,
			codeGraph: new CodeGraph(new Map(), new Map(), new Map()),
		};
	};

	deleteIndex = async () => {
		await this.index?.deleteIndex();
		try {
			await fs.promises.rm(path.join(this.directory, "edges.json"));
		} catch (error) {
			console.error("Error deleting edge file", error);
		}
	};

	indexExists = async () => {
		return await this.index?.isIndexCreated();
	};

	retrieveDocuments = async (query: string, k = 10): Promise<Document[]> => {
		const embeddings = await this.embedder.embedQuery(query);
		const results = await this.index?.queryItems(embeddings, k);
		return (
			results?.map((r) => {
				return {
					...r.item,
					pageContent: String(r.item.metadata.text),
				};
			}) || []
		);
	};

	findDocumentsByPath = async (filePaths: string[]): Promise<Document[]> => {
		const results = await this.index?.listItemsByMetadata({
			filePath: { $in: filePaths },
		});
		return (
			results?.map((r) => {
				return {
					...r,
					pageContent: String(r.metadata.text),
				};
			}) || []
		);
	};

	deleteDocuments = async (ids: string[]) => {
		for (const id of ids || []) {
			console.log("Deleting document", id);
			await this.index?.deleteItem(id);
		}
	};

	save = async (
		documents: Document[],
		importEdges: SerializeMap,
		exportEdges: SerializeMap,
		symbolTable: SymbolTable,
		shouldPurgeStaleDocuments = false
	) => {
		if (shouldPurgeStaleDocuments) {
			const filePaths = new Set<string>(
				documents.map((doc) => doc.metadata.filePath)
			);
			const relatedDocs = await this.findDocumentsByPath(
				Array.from(filePaths.values())
			);
			console.log(
				"Storing documents",
				documents.map((d) => d.id)
			);
			await this.deleteDocuments(relatedDocs.map((doc) => doc.id!));
		}

		for (const doc of documents) {
			const embeddings = await this.embedder.embedQuery(doc.pageContent);
			await this.index?.insertItem({
				id: doc.id,
				vector: embeddings,
				metadata: {
					...doc.metadata,
					text: doc.pageContent,
				},
			});
		}

		const jsonString = JSON.stringify(
			{
				importEdges,
				exportEdges,
				symbolTable: Array.from(symbolTable.entries()).map(
					([key, value]) => [
						key,
						{
							nodeIds: Array.from(value.nodeIds),
							sha: value.sha,
						},
					]
				),
			},
			null,
			2
		);

		await fs.promises.writeFile(
			path.join(this.directory, "edges.json"),
			jsonString,
			{
				flag: "w",
			}
		);

		if (documents.length > 0) {
			console.log("Stored document", documents[0].metadata.filePath);
		}
	};
}
