import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	createUiRegistryGetTool,
	createUiRegistryListTool,
	createUiPresentTool,
} from "../tools/ui_registry";

const resolveWorkspace = (): string => {
	const cwd = process.cwd();
	if (existsSync(join(cwd, "skills", "ui-registry", "registry.json"))) {
		return cwd;
	}
	const candidate = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
	if (existsSync(join(candidate, "skills", "ui-registry", "registry.json"))) {
		return candidate;
	}
	return cwd;
};

const workspace = resolveWorkspace();
const skillsDir = "skills";

describe("UI Registry Tools", () => {
	it("lists registry components", async () => {
		const tool = createUiRegistryListTool(workspace, skillsDir);
		const result = await tool.invoke({});
		const ids = result.components.map((component: any) => component.id);
		expect(ids.includes("stat_grid")).toBe(true);
		expect(ids.includes("line_chart")).toBe(true);
		expect(ids.includes("area_chart")).toBe(true);
		expect(ids.includes("bar_chart")).toBe(true);
		expect(ids.includes("data_table")).toBe(true);
		expect(ids.includes("timeline")).toBe(true);
		expect(ids.includes("status_list")).toBe(true);
	});

	it("returns schema details for a registry component", async () => {
		const tool = createUiRegistryGetTool(workspace, skillsDir);
		const result = await tool.invoke({ componentId: "stat_grid" });
		expect(result.componentId).toBe("stat_grid");
		expect(result.propsSchema).toBeTruthy();
	});

	it("returns schema details for new registry components", async () => {
		const tool = createUiRegistryGetTool(workspace, skillsDir);
		for (const componentId of [
			"line_chart",
			"area_chart",
			"bar_chart",
			"data_table",
			"timeline",
			"status_list",
		]) {
			const result = await tool.invoke({ componentId });
			expect(result.componentId).toBe(componentId);
			expect(result.propsSchema).toBeTruthy();
		}
	});

	it("renders UI payload when enabled", async () => {
		const tool = createUiPresentTool(workspace, skillsDir, true);
		const result = await tool.invoke({
			componentId: "stat_grid",
			props: {
				title: "Summary",
				stats: [{ label: "Alpha", value: "1" }],
			},
			textFallback: "Summary: Alpha 1",
			uiOnly: true,
		});
		expect(result.ui).toBeTruthy();
		expect(result.textFallback).toBe("Summary: Alpha 1");
	});

	it("suppresses UI payload when disabled", async () => {
		const tool = createUiPresentTool(workspace, skillsDir, false);
		const result = await tool.invoke({
			componentId: "stat_grid",
			props: {
				title: "Summary",
				stats: [{ label: "Alpha", value: "1" }],
			},
			textFallback: "Summary: Alpha 1",
		});
		expect(result.ui).toBeUndefined();
		expect(result.uiOnly).toBe(false);
	});
});
