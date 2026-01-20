import { z } from "zod";
import { HooksConfigSchema } from "@/agent/middleware/hooks/types.js";

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

// Zod schema for skills configuration
export const SkillsConfigSchema = z.object({
	repositoryOwner: z
		.string()
		.default("anthropics")
		.describe("GitHub repository owner for skills"),
	repositoryName: z
		.string()
		.default("skills")
		.describe("GitHub repository name for skills"),
	githubToken: z
		.string()
		.optional()
		.describe("GitHub personal access token for higher API rate limits"),
	skillsDirectory: z
		.string()
		.default("skills")
		.describe("Directory to install skills in"),
});

export type SkillsConfig = z.infer<typeof SkillsConfigSchema>;

// Zod schema for wingman.config.json
export const WingmanConfigSchema = z.object({
	logLevel: z
		.enum(["debug", "info", "warn", "error", "silent"])
		.optional()
		.default("info"),
	defaultAgent: z.string().optional(),
	recursionLimit: z.number().min(1).max(10).optional().default(100),
	hooks: HooksConfigSchema.optional().describe("Global hooks configuration"),
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
	skills: SkillsConfigSchema.optional().default({
		repositoryOwner: "anthropics",
		repositoryName: "skills",
		skillsDirectory: "skills",
	}),
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
