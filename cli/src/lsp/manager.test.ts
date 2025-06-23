import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { LspManager } from "./manager";
import { registerTypescriptAdapter } from "./adapters";
import { pathToFileURL } from "node:url";

describe("LspManager", () => {
	it("should retrieve symbols from a typescript file", async () => {
		const manager = new LspManager();
		const projectRoot = path.resolve(__dirname, "../../");
		const filePath = path.resolve(projectRoot, "test/data/example.ts");
		const fileUri = pathToFileURL(filePath).toString();
		const fileContent = await fs.readFile(filePath, "utf-8");

		const tsClient = await registerTypescriptAdapter(manager, projectRoot);

		tsClient.didOpen(fileUri, fileContent);
		const symbols = await tsClient.getSymbols(fileUri);

		expect(symbols).toBeDefined();
		expect(symbols.length).toBeGreaterThan(0);

		manager.shutdown();
	}, 10000);

	it("should find diagnostic errors in bad file", async () => {
		const manager = new LspManager();
		const projectRoot = path.resolve(__dirname, "../../");
		const filePath = path.resolve(projectRoot, "test/data/bad-file.ts");
		const fileUri = pathToFileURL(filePath).toString();
		const fileContent = await fs.readFile(filePath, "utf-8");

		const tsClient = await registerTypescriptAdapter(manager, projectRoot);

		tsClient.didOpen(fileUri, fileContent);
		const diagnostics = await tsClient.getDiagnostics(fileUri);

		expect(diagnostics).toBeDefined();
		expect(diagnostics.length).toBeGreaterThan(0);

		manager.shutdown();
	}, 10000);
});
