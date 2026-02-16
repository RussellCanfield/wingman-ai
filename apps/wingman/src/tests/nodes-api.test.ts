import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	createNodeApprovalStore,
	handleNodesApi,
} from "../gateway/http/nodes.js";

describe("node approvals api", () => {
	let tempDir: string | null = null;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
			tempDir = null;
		}
	});

	it("persists and updates node approval records", () => {
		tempDir = mkdtempSync(join(tmpdir(), "wingman-node-store-"));
		const store = createNodeApprovalStore(() => tempDir!);

		expect(store.isEnabled("desktop-a")).toBe(false);

		const enabled = store.setEnabled("desktop-a", true, "Desktop A", Date.now());
		expect(enabled.enabled).toBe(true);
		expect(store.isEnabled("desktop-a")).toBe(true);

		const marked = store.markSeen("desktop-a", "Desktop A (Renamed)");
		expect(marked?.name).toBe("Desktop A (Renamed)");
		expect(marked?.lastSeenAt).toBeTypeOf("number");

		const disabled = store.setEnabled("desktop-a", false);
		expect(disabled.enabled).toBe(false);
		expect(store.isEnabled("desktop-a")).toBe(false);
	});

	it("enables and revokes nodes through the HTTP handler", async () => {
		tempDir = mkdtempSync(join(tmpdir(), "wingman-node-api-"));
		const store = createNodeApprovalStore(() => tempDir!);
		const activeNodes = [
			{
				id: "node-1",
				name: "Desktop Node",
				clientId: "desktop-a",
				capabilities: ["system.notify"],
			},
		];
		const nodeManager = {
			getAllNodes: () => activeNodes,
			getNodesByClientId: (clientId: string) =>
				activeNodes.filter((node) => node.clientId === clientId),
			unregisterNode: (nodeId: string) => {
				const index = activeNodes.findIndex((node) => node.id === nodeId);
				if (index === -1) return false;
				activeNodes.splice(index, 1);
				return true;
			},
		};

		const enableResponse = await handleNodesApi(
			{} as any,
			nodeManager as any,
			store,
			new Request("http://localhost/api/nodes/desktop-a", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: true, name: "Desktop A" }),
			}),
			new URL("http://localhost/api/nodes/desktop-a"),
		);
		expect(enableResponse?.status).toBe(200);

		const listResponse = await handleNodesApi(
			{} as any,
			nodeManager as any,
			store,
			new Request("http://localhost/api/nodes", { method: "GET" }),
			new URL("http://localhost/api/nodes"),
		);
		expect(listResponse?.status).toBe(200);
		const listed = (await listResponse?.json()) as {
			nodes: Array<{ clientId: string; enabled: boolean; connected: boolean }>;
		};
		expect(listed.nodes[0]?.clientId).toBe("desktop-a");
		expect(listed.nodes[0]?.enabled).toBe(true);
		expect(listed.nodes[0]?.connected).toBe(true);

		const revokeResponse = await handleNodesApi(
			{} as any,
			nodeManager as any,
			store,
			new Request("http://localhost/api/nodes/desktop-a", {
				method: "DELETE",
			}),
			new URL("http://localhost/api/nodes/desktop-a"),
		);
		expect(revokeResponse?.status).toBe(200);
		expect(activeNodes.length).toBe(0);
		expect(store.isEnabled("desktop-a")).toBe(false);
	});
});
