import { z } from "zod";

// Zod schema for wingman.config.json
export const WingmanConfigSchema = z.object({
	logLevel: z
		.enum(["debug", "info", "warn", "error", "silent"])
		.optional()
		.default("info"),
	defaultAgent: z.string().optional(),
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
