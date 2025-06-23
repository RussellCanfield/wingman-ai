import { tool } from "@langchain/core/tools";
import { createPatch } from "diff";
import fs, { promises } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { baseFileSchema } from "./schemas";
import type { FileMetadata } from "@shared/types/Message";
import { ToolMessage } from "@langchain/core/messages";

export const writeFileSchema = baseFileSchema.extend({
	contents: z
		.string()
		.min(0)
		.describe(
			"The contents of the file as a string, this can never be empty or undefined.",
		),
});

/**
 * Generates a diff between existing file content and new code
 */
const generateDiffFromModifiedCode = async (
	newCode: string,
	filePath: string,
	originalCode?: string,
): Promise<string> => {
	try {
		if (!filePath) {
			throw new Error("File path is required");
		}

		if (typeof newCode !== "string") {
			throw new Error(`New code must be a string, received: ${typeof newCode}`);
		}

		const patch = createPatch(filePath, originalCode ?? "", newCode, "", "", {
			context: 3,
			ignoreWhitespace: true,
		});

		const stats = {
			additions: 0,
			deletions: 0,
		};

		// Safer line parsing
		const lines = patch.split("\n");
		for (const line of lines) {
			// Skip diff headers and metadata
			if (
				line.startsWith("+++") ||
				line.startsWith("---") ||
				line.startsWith("Index:") ||
				line.startsWith("===") ||
				line.startsWith("@@") ||
				line.startsWith("\\")
			) {
				continue;
			}

			if (line.startsWith("+")) {
				stats.additions++;
			} else if (line.startsWith("-")) {
				stats.deletions++;
			}
		}

		return `+${stats.additions},-${stats.deletions}`;
	} catch (error) {
		console.error("Error generating diff:", error);
		return "+0,-0"; // Safe fallback
	}
};

export const generateFileMetadata = async (
	workspace: string,
	id: string,
	input: z.infer<typeof writeFileSchema>,
) => {
	// Validate input before processing
	if (!input.contents && input.contents !== "") {
		throw new Error(`File contents are required but received: ${typeof input.contents}`);
	}

	if (!input.path) {
		throw new Error("File path is required");
	}

	let fileContents = "";
	const filePath = path.join(workspace, input.path);
	if (fs.existsSync(filePath)) {
		try {
			fileContents = await promises.readFile(filePath, {
				encoding: "utf-8",
			});
		} catch (e) {
			console.warn(`Failed to read file ${filePath}:`, e);
		}
	}

	return {
		id,
		path: input.path,
		code: input.contents,
		original: fileContents,
		diff: await generateDiffFromModifiedCode(
			input.contents,
			input.path,
			fileContents,
		),
	} satisfies FileMetadata;
};

/**
 * Creates a write file tool with the given workspace
 */
export const createWriteFileTool = (workspace: string, autoCommit = false) => {
	return tool(
		async (input, config) => {
			try {
				// Validate input early
				const validatedInput = writeFileSchema.parse(input);
				
				console.log("Write file tool input:", {
					path: validatedInput.path,
					contentsType: typeof validatedInput.contents,
					contentsLength: validatedInput.contents?.length ?? 0,
					hasContents: validatedInput.contents !== undefined
				});

				const file: FileMetadata = await generateFileMetadata(
					workspace,
					config.callbacks._parentRunId,
					validatedInput,
				);

				if (autoCommit) {
					file.accepted = true;

					// check if directory exists
					const dir = path.dirname(path.join(workspace, file.path));
					if (!fs.existsSync(dir)) {
						await fs.promises.mkdir(dir, { recursive: true });
					}

					if (file.code) {
						await promises.writeFile(path.join(workspace, file.path), file.code);
					} else {
						throw new Error("File code is undefined, cannot write file");
					}
				} else {
					// In manual mode, the args are supplemented with "pre-run" data points, restore those if present.
					if (config.toolCall) {
						file.accepted = config.toolCall.args.accepted;
						file.rejected = config.toolCall.args.rejected;
						file.diff = config.toolCall.args.diff;
						file.original = config.toolCall.args.original;
					}
				}

				return new ToolMessage({
					id: config.callbacks._parentRunId,
					content: `Successfully wrote file: ${input.path}`,
					tool_call_id: config.toolCall.id,
					name: "edit_file",
					additional_kwargs: {
						file: file,
					},
				});
			} catch (e) {
				console.error("Write file tool error:", e);
				console.error("Input received:", JSON.stringify(input, null, 2));
				throw e;
			}
		},
		{
			name: "edit_file",
			description:
				"Edit or write a file to the file system, use this tool when you need to create or edit a file. The contents need to be the full file contents, do not omit any code for the file.",
			schema: writeFileSchema,
			returnDirect: false,
		},
	);
};