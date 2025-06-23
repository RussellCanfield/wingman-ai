import * as path from "node:path";
import type { LspManager } from "../manager";

export const registerRustAdapter = (
	manager: LspManager,
	projectRoot: string,
) => {
	const rustAnalyzerPath = path.resolve(
		__dirname,
		"..",
		"..",
		"bin/rust-analyzer/rust-analyzer",
	);

	return manager.addClient(
		"rust",
		rustAnalyzerPath,
		[],
		{},
		`file://${projectRoot}`,
	);
};
