import type { LspManager } from "../manager";

export const registerPythonAdapter = (
	manager: LspManager,
	projectRoot: string,
) => {
	const pyrightPath = require.resolve("pyright/index.js");
	return manager.addClient(
		"python",
		"node",
		[pyrightPath, "--stdio"],
		{},
		`file://${projectRoot}`,
	);
};
