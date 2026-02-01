import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
	getExpectedRegistryPaths,
	loadUiRegistry,
	loadUiRegistryExample,
	resolveUiRegistryPath,
} from "../uiRegistry.js";

const UiRegistryListSchema = z.object({});

const UiRegistryGetSchema = z.object({
	componentId: z.string().min(1).describe("Registry key for the UI component"),
});

const UiLayoutSchema = z
	.object({
		type: z.enum(["stack", "row", "grid"]),
		gap: z.number().optional(),
		columns: z.number().optional(),
		align: z.enum(["start", "center", "end", "stretch"]).optional(),
	})
	.optional();

const UiPresentSchema = z.object({
	componentId: z.string().min(1).describe("Registry key for the UI component"),
	props: z
		.record(z.string(), z.any())
		.describe("Props to pass to the UI component"),
	layout: UiLayoutSchema,
	textFallback: z
		.string()
		.min(1)
		.describe("Required plain-text fallback for non-UI clients"),
	uiOnly: z
		.boolean()
		.optional()
		.default(true)
		.describe("Prefer UI rendering over assistant text"),
});

const summarizeComponent = (id: string, component: Record<string, any>) => ({
	id,
	label: component.label,
	description: component.description,
	useCases: component.useCases,
	tags: component.tags,
});

const validateRequiredProps = (component: Record<string, any>, props: Record<string, any>) => {
	const required = component?.propsSchema?.required;
	if (!Array.isArray(required) || required.length === 0) return;
	const missing = required.filter((key) => !(key in props));
	if (missing.length > 0) {
		throw new Error(
			`Missing required props for ${component?.label ?? "component"}: ${missing.join(", ")}`,
		);
	}
};

export const createUiRegistryListTool = (
	workspace: string,
	skillsDirectory: string,
) => {
	return tool(
		async () => {
			const resolution = await resolveUiRegistryPath(
				workspace,
				skillsDirectory,
			);
			if (!resolution) {
				const paths = getExpectedRegistryPaths(workspace, skillsDirectory);
				throw new Error(
					`UI registry not found. Checked ${paths.workspacePath} and ${paths.bundledPath}`,
				);
			}
			const registry = await loadUiRegistry(resolution.path);
			if (!registry) {
				throw new Error(`UI registry failed to load from ${resolution.path}`);
			}
			return {
				version: registry.version,
				components: Object.entries(registry.components || {}).map(
					([id, component]) => summarizeComponent(id, component as any),
				),
			};
		},
		{
			name: "ui_registry_list",
			description: "List available UI registry components by key.",
			schema: UiRegistryListSchema,
		},
	);
};

export const createUiRegistryGetTool = (
	workspace: string,
	skillsDirectory: string,
) => {
	return tool(
		async ({ componentId }) => {
			const resolution = await resolveUiRegistryPath(
				workspace,
				skillsDirectory,
			);
			if (!resolution) {
				const paths = getExpectedRegistryPaths(workspace, skillsDirectory);
				throw new Error(
					`UI registry not found. Checked ${paths.workspacePath} and ${paths.bundledPath}`,
				);
			}
			const registry = await loadUiRegistry(resolution.path);
			if (!registry) {
				throw new Error(`UI registry failed to load from ${resolution.path}`);
			}
			const component = registry.components?.[componentId];
			if (!component) {
				const available = Object.keys(registry.components || {}).join(", ");
				throw new Error(
					`Unknown UI component "${componentId}". Available: ${available || "none"}`,
				);
			}
			const example = await loadUiRegistryExample(
				resolution.path,
				component.exampleRef,
			);
			return {
				componentId,
				...component,
				example,
			};
		},
		{
			name: "ui_registry_get",
			description:
				"Get schema and usage details for a UI registry component key.",
			schema: UiRegistryGetSchema,
		},
	);
};

export const createUiPresentTool = (
	workspace: string,
	skillsDirectory: string,
	dynamicUiEnabled: boolean,
) => {
	return tool(
		async ({ componentId, props, layout, textFallback, uiOnly }) => {
			const resolution = await resolveUiRegistryPath(
				workspace,
				skillsDirectory,
			);
			if (!resolution) {
				const paths = getExpectedRegistryPaths(workspace, skillsDirectory);
				throw new Error(
					`UI registry not found. Checked ${paths.workspacePath} and ${paths.bundledPath}`,
				);
			}
			const registry = await loadUiRegistry(resolution.path);
			if (!registry) {
				throw new Error(`UI registry failed to load from ${resolution.path}`);
			}
			const component = registry.components?.[componentId];
			if (!component) {
				const available = Object.keys(registry.components || {}).join(", ");
				throw new Error(
					`Unknown UI component "${componentId}". Available: ${available || "none"}`,
				);
			}

			validateRequiredProps(component as any, props);

			const payload: Record<string, any> = {
				componentId,
				props,
				textFallback,
				uiOnly: dynamicUiEnabled ? uiOnly : false,
			};

			if (dynamicUiEnabled) {
				payload.ui = {
					registry: "webui",
					layout,
					components: [{ component: componentId, props }],
				};
			}

			return payload;
		},
		{
			name: "ui_present",
			description:
				"Render a registered UI component with props and a required text fallback.",
			schema: UiPresentSchema,
		},
	);
};
