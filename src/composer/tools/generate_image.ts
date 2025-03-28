import { tool } from "@langchain/core/tools";
import { baseToolSchema } from "./schemas";
import { ToolMessage } from "@langchain/core/messages";
import type { AIProvider } from "../../service/base";
import { z } from "zod";

export const generateImageSchema = baseToolSchema.extend({
	imageDescription: z.string().describe("The description of the image"),
});

/**
 * Creates a tool that reads file contents
 */
export const createImageGenerationTool = (aiProvider: AIProvider) => {
	return tool(
		async (input, config) => {
			if (!aiProvider.generateImage) {
				throw new Error("Image generation not supported");
			}

			const result = await aiProvider.generateImage(input.imageDescription);

			return new ToolMessage({
				id: config.callbacks._parentRunId,
				content: "Image generated successfully",
				additional_kwargs: {
					image: `data:image/png;base64,${result}`,
				},
				tool_call_id: config.toolCall.id,
			});
		},
		{
			name: "generate_image",
			description:
				"Generates an image based off a description, provide a detailed description of the image you want to create.",
			schema: generateImageSchema,
		},
	);
};
