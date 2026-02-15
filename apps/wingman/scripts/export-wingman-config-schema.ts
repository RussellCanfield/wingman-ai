#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	buildWingmanConfigJsonSchema,
	WINGMAN_CONFIG_JSON_SCHEMA_ID,
} from "../src/cli/config/jsonSchema.js";

const repositoryRoot = join(import.meta.dir, "..", "..", "..");
const outputPaths = [
	join(import.meta.dir, "..", "generated", "wingman.config.schema.json"),
	join(
		repositoryRoot,
		"apps",
		"docs-website",
		"docs",
		"public",
		"schemas",
		"wingman.config.schema.json",
	),
];

async function exportSchema(): Promise<void> {
	const schema = buildWingmanConfigJsonSchema();
	const payload = `${JSON.stringify(schema, null, 2)}\n`;

	for (const outputPath of outputPaths) {
		await mkdir(dirname(outputPath), { recursive: true });
		await writeFile(outputPath, payload, "utf-8");
		console.log(`Wrote ${outputPath}`);
	}

	console.log(`Published schema id: ${WINGMAN_CONFIG_JSON_SCHEMA_ID}`);
}

await exportSchema();
