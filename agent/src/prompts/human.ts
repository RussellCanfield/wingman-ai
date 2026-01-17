import { HumanMessage } from "@langchain/core/messages";
import path from "node:path";
import type { WingmanRequest } from "../agent";
import { loadFiles } from "../utils";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatXAI } from "@langchain/xai";

export const buildHumanMessages = async (
	request: WingmanRequest,
	cwd: string,
	model: BaseChatModel | ChatXAI,
) => {
	const messages: HumanMessage[] = [
		new HumanMessage({
			content: request.input,
		}),
	];

	let prompt = "";
	if (request.contextDirectories) {
		prompt += `# Context Directories
The user has provided the following directories as context to help you understand their current work and codebase state.
${request.contextDirectories.map((d) => `\n- ${d}`).join("")}`;
	}

	if (request.contextFiles) {
		const loadedFiles = await loadFiles(cwd, request.contextFiles);
		prompt += `\n\n# Context Files
The user has provided the following files as context to help you understand their current work and codebase state.

## Important Notes:
- **These represent the LATEST version** of each file - you do not need to read them again using tools
- **Use this context judiciously** - reference these files when they're directly relevant to the user's request
- **File relationships matter** - consider how these files interact with each other and the broader codebase
- **Assume currency** - treat this as the most up-to-date state of the user's code

<context_files>
${loadedFiles.map((f) => `<file>\nPath: ${path.relative(cwd, f.path)}\nContents:\n ${f.code}\n</file>`).join("\n\n")}
</context_files>
        `;
	}

	if (prompt) {
		if (model instanceof ChatXAI) {
			prompt = `When generating code, always use proper syntax characters directly. 
Never use HTML entities or encoded characters unless they are absolutely necessary.
			
			${prompt}`;
		}
		messages.unshift(new HumanMessage({ content: prompt }));
	}

	return messages;
};
