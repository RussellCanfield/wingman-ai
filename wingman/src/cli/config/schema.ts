import { z } from "zod";

// Zod schema for search configuration
export const SearchConfigSchema = z.object({
	provider: z
		.enum(["duckduckgo", "perplexity"])
		.default("duckduckgo")
		.describe("Search provider to use"),
	maxResults: z
		.number()
		.min(1)
		.max(20)
		.optional()
		.default(5)
		.describe("Maximum number of search results to return"),
});

export type SearchConfig = z.infer<typeof SearchConfigSchema>;

// Zod schema for wingman.config.json
export const WingmanConfigSchema = z.object({
	logLevel: z
		.enum(["debug", "info", "warn", "error", "silent"])
		.optional()
		.default("info"),
	defaultAgent: z.string().optional(),
	search: SearchConfigSchema.optional().default({
		provider: "duckduckgo",
		maxResults: 5,
	}),
	cli: z
		.object({
			theme: z.string().default("default"),
			outputMode: z.enum(["auto", "interactive", "json"]).default("auto"),
		})
		.default({ theme: "default", outputMode: "auto" }),
});

export type WingmanConfigType = z.infer<typeof WingmanConfigSchema>;

// Validation function
export function validateConfig(data: unknown): {
	success: boolean;
	data?: WingmanConfigType;
	error?: string;
} {
	try {
		const validated = WingmanConfigSchema.parse(data);
		return { success: true, data: validated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues
					.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
					.join(", "),
			};
		}
		return { success: false, error: String(error) };
	}
}
