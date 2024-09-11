import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type { Document } from "@langchain/core/documents";
import {
	CodeGraph,
	CodeGraphNodeMap,
	createCodeNode,
	generateCodeNodeId,
} from "../server/files/graph";
import { Location, Range } from "vscode-languageserver";
import { convertIdToFileUri } from "../server/files/utils";
import { LocalIndex } from "vectra";
import { EmbeddingsInterface } from "../service/embeddings/base";

export type SerializeMap = [string, string[]][];

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
			const edgeDetails = JSON.parse(
				await fs.promises.readFile(
					path.join(this.directory, "edges.json"),
					"utf-8"
				)
			) as {
				importEdges: SerializeMap;
				exportEdges: SerializeMap;
			};

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

			return {
				store: this.index,
				codeGraph: new CodeGraph(nodes, exportEdges, importEdges),
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
		exportEdges: SerializeMap
	) => {
		const filePaths = documents.map((doc) => doc.metadata.filePath);
		const relatedDocs = await this.findDocumentsByPath(filePaths);
		await this.deleteDocuments(relatedDocs.map((doc) => doc.id!));

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

		console.log("Saved store to disk", this.directory);
	};
}
