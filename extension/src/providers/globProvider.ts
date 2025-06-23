import path from "node:path";
import { scanDirectory } from "../composer/utils";
import type { AIProvider } from "../service/base";

export const generateWorkspaceGlobPatterns = async (
	aiProvider: AIProvider,
	workspace: string,
) => {
	const model = aiProvider.getModel();

	const contents = await scanDirectory(workspace, 5);
	const fileExts = new Set(
		contents.filter((c) => c.type === "file").map((f) => path.extname(f.path)),
	);

	return model.invoke(`Analyze the following file extensions and create a glob pattern.
The glob pattern must only match files that can contain code such as js,ts,tsx,jsx,cs etc.

File Extensions:
${Array.from(fileExts).join("\n")}

Do not return any additional text just the glob pattern!
`);
};
