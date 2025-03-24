import { tool } from "@langchain/core/tools";
import { baseToolSchema } from "./schemas";
import { ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import TurndownService from "turndown";
import * as cheerio from "cheerio";
import { ensureChromium } from "../../utils/chromium";

// Simplified schema with focused options
export const webSearchSchema = baseToolSchema.extend({
	url: z.string().describe("The url to retrieve contents for"),
	options: z
		.object({
			timeout: z
				.number()
				.optional()
				.describe(
					"Timeout in ms for the entire fetch operation (default: 10000)",
				),
			retries: z
				.number()
				.optional()
				.describe("Number of times to retry fetching (default: 2)"),
			delay: z
				.number()
				.optional()
				.describe("Delay between retries in ms (default: 2000)"),
		})
		.optional()
		.describe("Options for handling content fetching"),
});

/**
 * Creates a tool that searches a web page and returns its content as markdown
 * Simplified implementation with improved SPA detection
 */
export const createWebSearchTool = (storagePath: string) => {
	return tool(
		async (input, config) => {
			let browser: any;
			try {
				const stats = await ensureChromium(storagePath);
				browser = await stats.puppeteer.launch({
					args: [
						"--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
					],
					executablePath: stats.executablePath,
				});
				// (latest version of puppeteer does not add headless to user agent)
				const page = await browser?.newPage();

				if (!browser || !page) {
					throw new Error("Browser not initialized");
				}

				await page.goto(input.url, {
					timeout: 10_000,
					waitUntil: ["domcontentloaded", "networkidle2"],
				});
				const content = await page.content();

				// use cheerio to parse and clean up the HTML
				const $ = cheerio.load(content);
				$("script, style, nav, footer, header").remove();

				// convert cleaned HTML to markdown
				const turndownService = new TurndownService();
				const markdown = turndownService.turndown($.html());

				return new ToolMessage({
					id: config.callbacks._parentRunId,
					content: JSON.stringify({
						id: config.toolCall.id,
						content: markdown,
						url: input.url,
						explanation: input.explanation,
					}),
					tool_call_id: config.toolCall.id,
				});
			} catch (error) {
				return `Error fetching or processing the URL: ${(error as Error).message}`;
			} finally {
				if (browser) {
					await browser?.close();
				}
			}
		},
		{
			name: "web_search",
			description:
				"Fetches the contents of a URL, returning them in a markdown format. Use this tool if the user asks you about a URL specifically.",
			schema: webSearchSchema,
		},
	);
};
