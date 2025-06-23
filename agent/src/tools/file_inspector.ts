import { tool } from "@langchain/core/tools";
import { baseFileSchema } from "./schemas";
import { ToolMessage } from "@langchain/core/messages";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { DiagnosticRetriever } from "../files/diagnostics";

export const fileInspectorSchema = baseFileSchema.extend({});

/**
 * Inspects a file for linting issues, syntax errors, and other diagnostics.
 */
export const createFileInspectorTool = (
	retriever: DiagnosticRetriever,
	workspace: string,
) => {
	return tool(
		async (input, config) => {
			let fileUri = input.path;

			if (!path.isAbsolute(fileUri)) {
				fileUri = pathToFileURL(path.join(workspace, fileUri)).toString();
			}

			const result = await retriever.getFileDiagnostics([fileUri]);

			return new ToolMessage({
				id: config.callbacks._parentRunId,
				content: "File inspection completed successfully",
				tool_call_id: config.toolCall.id,
			});
		},
		{
			name: "file_inspector",
			description:
				"Inspects a file for linting issues, syntax errors, and other diagnostics.",
			schema: fileInspectorSchema,
		},
	);
};
