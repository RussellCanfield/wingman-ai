// import { tool } from "@langchain/core/tools";
// import fs, { promises } from "node:fs";
// import path from "node:path";
// import type { FileParser } from "../files/parser";
// import { pathToFileURL } from "node:url";
// import { baseToolSchema } from "./schemas";
// import z from "zod/v4";

// export const browserActionSchema = baseToolSchema.extend({
// 	url: z.string().describe("The URL provided for the launch action"),
// 	coordinate: z
// 		.object({
// 			x: z.number().describe("X coordinate for the action"),
// 			y: z.number().describe("Y coordinate for the action"),
// 		})
// 		.describe("Coordinates for the action"),
// 	action: z.string().describe(`The action to perform. The available actions are:
// * launch: Launch a new Puppeteer-controlled browser instance at the specified URL. This **must always be the first action**.
//     - Use with the \`url\` parameter to provide the URL.
//     - Ensure the URL is valid and includes the appropriate protocol (e.g. http://localhost:3000/page, file:///path/to/file.html, etc.)
// * click: Click at a specific x,y coordinate.
//     - Use with the \`coordinate\` parameter to specify the location.
//     - Always click in the center of an element (icon, button, link, etc.) based on coordinates derived from a screenshot.
// * type: Type a string of text on the keyboard. You might use this after clicking on a text field to input text.
//     - Use with the \`text\` parameter to provide the string to type.
// * scroll_down: Scroll down the page by one page height.
// * scroll_up: Scroll up the page by one page height.
// * close: Close the Puppeteer-controlled browser instance. This **must always be the final browser action**.`),
// 	text: z.string().describe("Provide text for the type of action to perform"),
// 	explanation: z.string().describe("Provide a brief explanation of the action"),
// });

// /**
//  * Creates a tool that can launch a browser and perform actions
//  */
// export const createBrowserActionTool = () => {
// 	return tool(
// 		async (input, config) => {
// 			const filePath = path.isAbsolute(input.path)
// 				? input.path
// 				: path.join(workspace, input.path);

// 			if (!fs.existsSync(filePath)) {
// 				return "File does not exist (create if required).";
// 			}

// 			const imports: string[] = [];
// 			const exports: string[] = [];

// 			if (fileParser) {
// 				const result = await fileParser.extractFileRelationships(
// 					pathToFileURL(filePath).toString(),
// 				);
// 				imports.push(...result.imports);
// 				exports.push(...result.exports);
// 			}

// 			// return new ToolMessage({
// 			// 	id: config.callbacks._parentRunId,
// 			// 	content: JSON.stringify({
// 			// 		id: config.toolCall.id,
// 			// 		content: await promises.readFile(filePath, "utf-8"),
// 			// 		path: path.relative(workspace, input.path),
// 			// 		explanation: input.explanation,
// 			// 		importedBy: imports,
// 			// 		exportedTo: exports,
// 			// 	}),
// 			// 	tool_call_id: config.toolCall.id,
// 			// });

// 			return await promises.readFile(filePath, "utf-8");
// 		},
// 		{
// 			name: "read_file",
// 			description:
// 				"Reads the contents of a specific file, includes file path, files that depend on this file (imported by), and files that consume this file (exported to) in response.",
// 			schema: readFileSchema,
// 		},
// 	);
// };
