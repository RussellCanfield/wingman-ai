import * as path from "node:path";
import type { LspManager } from "../manager";

export const registerCsharpAdapter = (
	manager: LspManager,
	projectRoot: string,
) => {
	const omniSharpPath = path.resolve(
		__dirname,
		"..",
		"..",
		"bin/omnisharp/run",
	);

	return manager.addClient(
		"csharp",
		omniSharpPath,
		["--languageserver", "--hostPID", process.pid.toString()],
		{},
		`file://${projectRoot}`,
	);
};
