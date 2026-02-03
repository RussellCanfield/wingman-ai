import type { HookDefinition, HookEntryConfig } from "./types.js";
import type { InternalHooksConfig } from "./types.js";
import type { Logger } from "@/logger.js";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as yaml from "js-yaml";

type HookFrontmatter = {
	name?: string;
	description?: string;
	events?: string[];
	export?: string;
};

const parseFrontmatter = (content: string): { meta: HookFrontmatter } => {
	const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
	const match = content.match(frontmatterRegex);
	if (!match) {
		throw new Error("Invalid HOOK.md format: missing frontmatter");
	}
	const [, frontmatter] = match;
	const meta = (yaml.load(frontmatter) as HookFrontmatter) || {};
	return { meta };
};

const resolveHandlerPath = (dir: string): string | null => {
	const candidates = ["handler.ts", "handler.js", "index.ts", "index.js"];
	for (const candidate of candidates) {
		const path = join(dir, candidate);
		if (existsSync(path)) {
			return path;
		}
	}
	return null;
};

export class InternalHookLoader {
	constructor(
		private baseDir: string,
		private config: InternalHooksConfig | undefined,
		private logger: Logger,
	) {}

	async load(): Promise<HookDefinition[]> {
		if (!this.config?.enabled) {
			return [];
		}

		const entries: Record<string, HookEntryConfig> = this.config.entries || {};
		const enabledEntries = Object.entries(entries).filter(
			([, entry]) => entry?.enabled !== false,
		);
		const enabledNames = new Set(enabledEntries.map(([name]) => name));

		const dirs = [join(this.baseDir, "hooks"), ...(this.config.load?.extraDirs || [])];
		const hooks: HookDefinition[] = [];

		for (const dir of dirs) {
			if (!existsSync(dir) || !statSync(dir).isDirectory()) {
				continue;
			}

			const hookDirs = readdirSync(dir, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name);

			for (const hookDirName of hookDirs) {
				const hookDir = join(dir, hookDirName);
				const hookDoc = join(hookDir, "HOOK.md");
				if (!existsSync(hookDoc)) {
					continue;
				}

				try {
					const hookDocContent = await Bun.file(hookDoc).text();
					const { meta } = parseFrontmatter(hookDocContent);
					const name = meta.name || hookDirName;
					if (!enabledNames.has(name)) {
						continue;
					}

					const handlerPath = resolveHandlerPath(hookDir);
					if (!handlerPath) {
						this.logger.warn(`Hook ${name} missing handler file`);
						continue;
					}

					const mod = await import(pathToFileURL(handlerPath).href);
					const exportName = meta.export || "default";
					const handler = mod[exportName] as HookDefinition["handler"];
					if (!handler) {
						this.logger.warn(`Hook ${name} missing export: ${exportName}`);
						continue;
					}

					const events = Array.isArray(meta.events) ? meta.events : [];
					if (events.length === 0) {
						this.logger.warn(`Hook ${name} missing events`);
						continue;
					}

					const entry = entries[name] as HookEntryConfig | undefined;
					hooks.push({
						name,
						description: meta.description,
						events,
						handler,
						entry,
					});
				} catch (error) {
					this.logger.error(`Failed to load hook from ${hookDir}: ${error}`);
				}
			}
		}

		return hooks;
	}
}
