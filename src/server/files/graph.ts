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

export class CodeGraph {
	private skeletonNodes: Map<string, SkeletonizedCodeGraphNode> = new Map();
	private nodes: CodeGraphNodeMap = new Map();
	private edgesExport: CodeGraphEdgeMap = new Map();
	private edgesImport: CodeGraphEdgeMap = new Map();

	constructor(
		nodes?: CodeGraphNodeMap,
		edgesExport?: CodeGraphEdgeMap,
		edgesImport?: CodeGraphEdgeMap
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
	}

	public addSkeletonNode(node: SkeletonizedCodeGraphNode) {
		this.skeletonNodes.set(node.id, node);
	}

	public getSkeletonNode(id: string) {
		return this.skeletonNodes.get(id);
	}

	public addNode(node: CodeGraphNode) {
		this.nodes.set(node.id, node);
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

	public getSkeletonNodes() {
		return Array.from(this.skeletonNodes.values());
	}
}

export function generateCodeNodeId(location: Location): string {
	return `${location.uri}-${location.range.start.line}-${location.range.start.character}`;
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
