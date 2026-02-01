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
		expect(result.components.some((component: any) => component.id === "stat_grid")).toBe(
			true,
		);
	});

	it("returns schema details for a registry component", async () => {
		const tool = createUiRegistryGetTool(workspace, skillsDir);
		const result = await tool.invoke({ componentId: "stat_grid" });
		expect(result.componentId).toBe("stat_grid");
		expect(result.propsSchema).toBeTruthy();
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
