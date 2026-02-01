import type { ComponentType } from "react";
import StatGrid from "./components/StatGrid";

export type RegistryEntry = {
	id: string;
	version: string;
	kind: "local" | "remote";
	component?: ComponentType<any>;
	remote?: {
		url: string;
		exportName?: string;
	};
};

const registry = new Map<string, RegistryEntry>();

export function registerLocalComponent(entry: Omit<RegistryEntry, "kind">): void {
	registry.set(entry.id, { ...entry, kind: "local" });
}

export function registerRemoteComponent(entry: Omit<RegistryEntry, "kind" | "component">): void {
	registry.set(entry.id, { ...entry, kind: "remote" });
}

export async function resolveComponent(
	id: string,
): Promise<ComponentType<any> | null> {
	const entry = registry.get(id);
	if (!entry) return null;
	if (entry.kind === "local") return entry.component ?? null;
	if (!entry.remote?.url) return null;
	try {
		const module = await import(/* @vite-ignore */ entry.remote.url);
		const component = entry.remote.exportName
			? module[entry.remote.exportName]
			: module.default;
		return typeof component === "function" ? component : null;
	} catch {
		return null;
	}
}

export function getRegistryEntries(): RegistryEntry[] {
	return [...registry.values()];
}

registerLocalComponent({
	id: "stat_grid",
	version: "1.0.0",
	component: StatGrid,
});

registerLocalComponent({
	id: "StatGrid",
	version: "1.0.0",
	component: StatGrid,
});
