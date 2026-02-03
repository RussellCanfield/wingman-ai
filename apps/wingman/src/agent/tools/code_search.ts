import { tool } from "langchain";
import { z } from "zod";
import { spawn, execSync } from "node:child_process";

/**
 * Check if ripgrep is available on the system
 */
function isRipgrepAvailable(): boolean {
	try {
		execSync("rg --version", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

/**
 * Creates a tool that searches code using ripgrep (or grep as fallback)
 * This provides fast, structured code search across the codebase
 */
export const createCodeSearchTool = (workspace: string) => {
	const useRipgrep = isRipgrepAvailable();

	return tool(
		async ({
			pattern,
			path,
			type,
			context = 2,
			caseSensitive = false,
		}: {
			pattern: string;
			path?: string;
			type?: string;
			context?: number;
			caseSensitive?: boolean;
		}) => {
			return new Promise<string>((resolve) => {
				try {
					let command: string;
					let args: string[] = [];

					if (useRipgrep) {
						// Build ripgrep command arguments
						command = "rg";

						// Add context lines
						if (context > 0) {
							args.push("-C", String(context));
						}

						// Add case sensitivity
						if (!caseSensitive) {
							args.push("-i");
						}

						// Add line numbers
						args.push("-n");

						// Add file type filter
						if (type) {
							args.push("-t", type);
						}

						// Add the pattern
						args.push(pattern);

						// Add the path (defaults to current directory)
						if (path) {
							args.push(path);
						} else {
							args.push(".");
						}
					} else {
						// Build grep command arguments (fallback)
						command = "grep";

						// Add recursive search
						args.push("-r");

						// Add line numbers
						args.push("-n");

						// Add context lines
						if (context > 0) {
							args.push("-C", String(context));
						}

						// Add case sensitivity
						if (!caseSensitive) {
							args.push("-i");
						}

						// Add file type filter (basic extension matching)
						if (type) {
							args.push("--include", `*.${type}`);
						}

						// Add the pattern
						args.push(pattern);

						// Add the path (defaults to current directory)
						if (path) {
							args.push(path);
						} else {
							args.push(".");
						}
					}

					// Execute the search command
					const proc = spawn(command, args, {
						cwd: workspace,
						shell: false,
					});

					let output = "";
					let errorOutput = "";

					proc.stdout.on("data", (data) => {
						output += data.toString();
					});

					proc.stderr.on("data", (data) => {
						errorOutput += data.toString();
					});

					proc.on("close", (code) => {
						// Both rg and grep use similar exit codes:
						// 0 = matches found
						// 1 = no matches found
						// 2+ = error occurred

						if (code === 0) {
							resolve(output || "No matches found");
						} else if (code === 1) {
							resolve("No matches found");
						} else {
							resolve(
								`Error searching code: ${errorOutput || "Unknown error"}`,
							);
						}
					});

					proc.on("error", (err) => {
						resolve(
							`Failed to execute ${command}: ${err.message}`,
						);
					});
				} catch (error) {
					resolve(`Error in code search: ${error}`);
				}
			});
		},
		{
			name: "code_search",
			description:
				"Search code patterns across the codebase using ripgrep (or grep as fallback). Fast and efficient for finding function definitions, variables, imports, or any text pattern. Returns file paths with line numbers and context.",
			schema: z.object({
				pattern: z
					.string()
					.describe(
						"The pattern to search for (regex or literal string). Examples: 'function.*processData', 'import.*React', 'TODO'",
					),
				path: z
					.string()
					.optional()
					.describe(
						"Optional: Directory or file to search in (e.g., 'src/', 'src/utils.ts'). Defaults to entire workspace.",
					),
				type: z
					.string()
					.optional()
					.describe(
						"Optional: File type filter (e.g., 'ts', 'js', 'py', 'go'). Searches only files of this type.",
					),
				context: z
					.number()
					.optional()
					.default(2)
					.describe(
						"Optional: Number of context lines to show around matches. Default is 2.",
					),
				caseSensitive: z
					.boolean()
					.optional()
					.default(false)
					.describe("Optional: Whether search should be case-sensitive."),
			}),
		},
	);
};
