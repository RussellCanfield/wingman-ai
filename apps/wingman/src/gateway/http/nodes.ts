import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { NodeManager } from "../node.js";
import type { GatewayHttpContext } from "./types.js";

const CLIENT_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

const normalizeClientId = (raw: string): string | null => {
	let decoded: string;
	try {
		decoded = decodeURIComponent(raw);
	} catch {
		return null;
	}
	const trimmed = decoded.trim();
	if (!trimmed) return null;
	if (!CLIENT_ID_PATTERN.test(trimmed)) return null;
	return trimmed;
};

export type NodeApprovalRecord = {
	clientId: string;
	name?: string;
	enabled: boolean;
	createdAt: number;
	updatedAt: number;
	lastSeenAt?: number;
};

type NodeApprovalStore = {
	load: () => NodeApprovalRecord[];
	save: (records: NodeApprovalRecord[]) => void;
	isEnabled: (clientId: string) => boolean;
	setEnabled: (
		clientId: string,
		enabled: boolean,
		name?: string,
		lastSeenAt?: number,
	) => NodeApprovalRecord;
	markSeen: (clientId: string, name?: string) => NodeApprovalRecord | null;
};

export const createNodeApprovalStore = (
	resolveConfigDirPath: () => string,
): NodeApprovalStore => {
	const resolvePath = () => {
		const configDir = resolveConfigDirPath();
		mkdirSync(configDir, { recursive: true });
		return join(configDir, "nodes.json");
	};

	const readRecords = (): NodeApprovalRecord[] => {
		const path = resolvePath();
		if (!existsSync(path)) {
			return [];
		}
		try {
			const raw = readFileSync(path, "utf-8");
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			const records: NodeApprovalRecord[] = [];
			for (const entry of parsed) {
				if (!entry || typeof entry !== "object") continue;
				const typed = entry as Partial<NodeApprovalRecord>;
				const clientId =
					typeof typed.clientId === "string" ? typed.clientId : "";
				if (!clientId.trim()) continue;
				records.push({
					clientId: clientId.trim(),
					name:
						typeof typed.name === "string" && typed.name.trim()
							? typed.name.trim()
							: undefined,
					enabled: typed.enabled !== false,
					createdAt:
						typeof typed.createdAt === "number" ? typed.createdAt : Date.now(),
					updatedAt:
						typeof typed.updatedAt === "number" ? typed.updatedAt : Date.now(),
					lastSeenAt:
						typeof typed.lastSeenAt === "number" ? typed.lastSeenAt : undefined,
				});
			}
			return records;
		} catch {
			return [];
		}
	};

	const writeRecords = (records: NodeApprovalRecord[]) => {
		const path = resolvePath();
		writeFileSync(path, JSON.stringify(records, null, 2));
	};

	const replaceRecord = (
		records: NodeApprovalRecord[],
		nextRecord: NodeApprovalRecord,
	) => {
		const index = records.findIndex(
			(record) => record.clientId === nextRecord.clientId,
		);
		if (index >= 0) {
			records[index] = nextRecord;
		} else {
			records.unshift(nextRecord);
		}
		return records;
	};

	return {
		load: () => readRecords(),
		save: (records) => writeRecords(records),
		isEnabled: (clientId) => {
			const trimmed = clientId.trim();
			if (!trimmed) return false;
			return readRecords().some(
				(record) => record.clientId === trimmed && record.enabled,
			);
		},
		setEnabled: (clientId, enabled, name, lastSeenAt) => {
			const trimmed = clientId.trim();
			const now = Date.now();
			const records = readRecords();
			const existing = records.find((record) => record.clientId === trimmed);
			const nextRecord: NodeApprovalRecord = {
				clientId: trimmed,
				name:
					typeof name === "string" && name.trim()
						? name.trim()
						: existing?.name,
				enabled,
				createdAt: existing?.createdAt ?? now,
				updatedAt: now,
				lastSeenAt:
					typeof lastSeenAt === "number" ? lastSeenAt : existing?.lastSeenAt,
			};
			writeRecords(replaceRecord(records, nextRecord));
			return nextRecord;
		},
		markSeen: (clientId, name) => {
			const trimmed = clientId.trim();
			if (!trimmed) return null;
			const records = readRecords();
			const existing = records.find((record) => record.clientId === trimmed);
			if (!existing) return null;
			const now = Date.now();
			const nextRecord: NodeApprovalRecord = {
				...existing,
				name:
					typeof name === "string" && name.trim() ? name.trim() : existing.name,
				updatedAt: now,
				lastSeenAt: now,
			};
			writeRecords(replaceRecord(records, nextRecord));
			return nextRecord;
		},
	};
};

export const handleNodesApi = async (
	_ctx: GatewayHttpContext,
	nodeManager: NodeManager,
	store: NodeApprovalStore,
	req: Request,
	url: URL,
): Promise<Response | null> => {
	if (url.pathname === "/api/nodes" && req.method === "GET") {
		const approvals = store.load();
		const connectedNodes = nodeManager.getAllNodes();
		const connectedByClientId = new Map<
			string,
			ReturnType<typeof nodeManager.getAllNodes>
		>();
		for (const node of connectedNodes) {
			if (!node.clientId) continue;
			const bucket = connectedByClientId.get(node.clientId) || [];
			bucket.push(node);
			connectedByClientId.set(node.clientId, bucket);
		}

		const clientIds = new Set<string>([
			...approvals.map((record) => record.clientId),
			...connectedByClientId.keys(),
		]);

		const nodes = Array.from(clientIds)
			.map((clientId) => {
				const approval = approvals.find(
					(record) => record.clientId === clientId,
				);
				const connected = connectedByClientId.get(clientId) || [];
				const capabilities = Array.from(
					new Set(
						connected.flatMap((node) =>
							Array.isArray(node.capabilities) ? node.capabilities : [],
						),
					),
				);
				return {
					clientId,
					name: approval?.name || connected[0]?.name || clientId,
					enabled: approval?.enabled ?? false,
					createdAt: approval?.createdAt,
					updatedAt: approval?.updatedAt,
					lastSeenAt: approval?.lastSeenAt,
					connected: connected.length > 0,
					nodeIds: connected.map((node) => node.id),
					capabilities,
				};
			})
			.sort((a, b) => {
				const aTime = a.updatedAt || 0;
				const bTime = b.updatedAt || 0;
				return bTime - aTime;
			});

		return new Response(JSON.stringify({ nodes }, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	const clientMatch = url.pathname.match(/^\/api\/nodes\/([^/]+)$/);
	if (!clientMatch) {
		return null;
	}

	const clientId = normalizeClientId(clientMatch[1]);
	if (!clientId) {
		return new Response("valid clientId required", { status: 400 });
	}

	if (req.method === "PUT") {
		let body: { enabled?: boolean; name?: string };
		try {
			body = (await req.json()) as { enabled?: boolean; name?: string };
		} catch {
			return new Response("Invalid JSON body", { status: 400 });
		}
		if (typeof body.enabled !== "boolean") {
			return new Response("enabled boolean required", { status: 400 });
		}
		const nextRecord = store.setEnabled(
			clientId,
			body.enabled,
			body.name,
			body.enabled ? Date.now() : undefined,
		);
		if (!nextRecord.enabled) {
			const activeNodes = nodeManager.getNodesByClientId(clientId);
			for (const node of activeNodes) {
				nodeManager.unregisterNode(node.id);
			}
		}
		return new Response(JSON.stringify(nextRecord, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	if (req.method === "DELETE") {
		const nextRecord = store.setEnabled(clientId, false);
		const activeNodes = nodeManager.getNodesByClientId(clientId);
		for (const node of activeNodes) {
			nodeManager.unregisterNode(node.id);
		}
		return new Response(JSON.stringify(nextRecord, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	if (req.method === "GET") {
		const approvals = store.load();
		const approval = approvals.find((record) => record.clientId === clientId);
		const connected = nodeManager.getNodesByClientId(clientId);
		if (!approval && connected.length === 0) {
			return new Response("Node not found", { status: 404 });
		}
		return new Response(
			JSON.stringify(
				{
					clientId,
					name: approval?.name || connected[0]?.name || clientId,
					enabled: approval?.enabled ?? false,
					createdAt: approval?.createdAt,
					updatedAt: approval?.updatedAt,
					lastSeenAt: approval?.lastSeenAt,
					connected: connected.length > 0,
					nodeIds: connected.map((node) => node.id),
				},
				null,
				2,
			),
			{
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	return new Response("Method Not Allowed", { status: 405 });
};
