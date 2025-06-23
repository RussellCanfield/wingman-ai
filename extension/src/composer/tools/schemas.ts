import { z } from "zod";

export const baseToolSchema = z.object({
	explanation: z
		.string()
		.describe("One sentence explanation of why you chose this tool"),
});

export const baseFileSchema = baseToolSchema.extend({
	path: z.string().describe("The path of the file relative to the workspace"),
});
