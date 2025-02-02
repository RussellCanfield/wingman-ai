import type { Location } from "vscode-languageserver";

export type CodeGraphNode = {
	id: string;
	location: Location;
	parentNodeId?: string;
};

export type SkeletonizedCodeGraphNode = {
	skeleton: string;
} & CodeGraphNode;

export type CodeGraphNodeMap = Map<string, CodeGraphNode>;
export type CodeGraphEdgeMap = Map<string, Set<string>>;
export type SymbolTable = Map<string, FileDetails>;

export type FileDetails = {
	nodeIds: Set<string>;
	sha: string;
};

export class CodeGraph {
	// The symbol table helps manage file relationships to symbols, which can be used to manage the edges
	private symbolTable: SymbolTable = new Map();
	private nodes: CodeGraphNodeMap = new Map();
	private edgesExport: CodeGraphEdgeMap = new Map();
	private edgesImport: CodeGraphEdgeMap = new Map();

	constructor(
		nodes?: CodeGraphNodeMap,
		edgesExport?: CodeGraphEdgeMap,
		edgesImport?: CodeGraphEdgeMap,
		symbolTable?: SymbolTable
	) {
		if (nodes) {
			this.nodes = nodes;
		}

		if (edgesExport) {
			this.edgesExport = edgesExport;
		}

		if (edgesImport) {
			this.edgesImport = edgesImport;
		}

		if (symbolTable) {
			this.symbolTable = symbolTable;
		}
	}

	public deleteFile(file: string) {
		// Get the file details from the symbol table
		const fileDetails = this.symbolTable.get(file);
		if (!fileDetails) {
			return;
		}

		// Clean up all nodes associated with this file
		for (const nodeId of fileDetails.nodeIds) {
			// Remove the node
			this.nodes.delete(nodeId);

			// Clean up import edges
			this.edgesImport.delete(nodeId);
			for (const [, importSet] of this.edgesImport) {
				importSet.delete(nodeId);
			}

			// Clean up export edges
			this.edgesExport.delete(nodeId);
			for (const [, exportSet] of this.edgesExport) {
				exportSet.delete(nodeId);
			}
		}

		// Remove the file from the symbol table
		this.symbolTable.delete(file);
	}

	public removeFileFromSymbolTable(file: string) {
		const fileDetails = this.symbolTable.get(file);
		if (!fileDetails) return;

		// Clean up all nodes associated with this file
		for (const nodeId of fileDetails.nodeIds) {
			// Remove import edges
			this.edgesImport.delete(nodeId);
			for (const [, importSet] of this.edgesImport) {
				importSet.delete(nodeId);
			}

			// Remove export edges
			this.edgesExport.delete(nodeId);
			for (const [, exportSet] of this.edgesExport) {
				exportSet.delete(nodeId);
			}

			// Remove the node from the nodes map
			this.nodes.delete(nodeId);
		}

		// Remove the file entry from the symbol table
		this.symbolTable.delete(file);
	}

	public addOrUpdateFileInSymbolTable(
		file: string,
		fileDetails: FileDetails
	) {
		// Get the existing node IDs for this file, if any
		const existingNodeIds = (
			this.symbolTable.get(file) ||
			({
				nodeIds: new Set(),
				sha: "",
			} satisfies FileDetails)
		).nodeIds;

		// Find nodes that are no longer present in the file
		const removedNodeIds = new Set(
			[...existingNodeIds].filter((x) => !fileDetails.nodeIds.has(x))
		);

		// Remove import and export edges for the removed nodes
		for (const removedNodeId of removedNodeIds) {
			// Remove import edges
			this.edgesImport.delete(removedNodeId);
			for (const [, importSet] of this.edgesImport) {
				importSet.delete(removedNodeId);
			}

			// Remove export edges
			this.edgesExport.delete(removedNodeId);
			for (const [, exportSet] of this.edgesExport) {
				exportSet.delete(removedNodeId);
			}

			// Remove the node from the nodes map
			this.nodes.delete(removedNodeId);
		}

		// Update the symbol table with the new set of node IDs
		this.symbolTable.set(file, fileDetails);
	}

	public getSymbolTable() {
		return this.symbolTable;
	}

	public getFileFromSymbolTable(file: string) {
		return this.symbolTable.get(file);
	}

	public addNode(node: CodeGraphNode) {
		this.nodes.set(node.id, node);
	}

	public mergeImportEdges(importEdges: CodeGraphEdgeMap) {
		for (const [nodeId, edges] of importEdges) {
			if (this.edgesImport.has(nodeId)) {
				for (const edge of edges) {
					this.edgesImport.get(nodeId)?.add(edge);
				}
			} else {
				this.edgesImport.set(nodeId, edges);
			}
		}
	}

	public mergeExportEdges(exportEdges: CodeGraphEdgeMap) {
		for (const [nodeId, edges] of exportEdges) {
			if (this.edgesExport.has(nodeId)) {
				for (const edge of edges) {
					this.edgesExport.get(nodeId)?.add(edge);
				}
			} else {
				this.edgesExport.set(nodeId, edges);
			}
		}
	}

	public addImportEdge(nodeId: string, edge: string) {
		if (this.edgesImport.has(nodeId)) {
			this.edgesImport.get(nodeId)?.add(edge);
		} else {
			const edges = new Set<string>();
			edges.add(edge);
			this.edgesImport.set(nodeId, edges);
		}
	}

	public addExportEdge(nodeId: string, edge: string) {
		if (this.edgesExport.has(nodeId)) {
			this.edgesExport.get(nodeId)?.add(edge);
		} else {
			const edges = new Set<string>();
			edges.add(edge);
			this.edgesExport.set(nodeId, edges);
		}
	}

	public getNode(id: string) {
		return this.nodes.get(id);
	}

	public getExportEdge(id: string) {
		return this.edgesExport.get(id);
	}

	public getImportEdge(id: string) {
		return this.edgesImport.get(id);
	}

	public getExportEdges() {
		return this.edgesExport;
	}

	public getImportEdges() {
		return this.edgesImport;
	}

	public getNodes() {
		return Array.from(this.nodes.values());
	}
}

export function generateCodeNodeId(location: Location): string {
	return `${location.uri}-${location.range.start.line}-${location.range.start.character}`;
}

export function generateCodeNodeIdFromRelativePath(
	path: string,
	line: string,
	character: string
) {
	return `${path}-${line}-${character}`;
}

export function generateCodeNodeIdFromParts(
	uri: string,
	line: string,
	character: string
): string {
	return `${uri}-${line}-${character}`;
}

export function createCodeNode(location: Location): CodeGraphNode {
	return {
		id: generateCodeNodeId(location),
		location,
	};
}
