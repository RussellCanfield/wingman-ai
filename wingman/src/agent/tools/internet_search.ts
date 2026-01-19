import { tool } from "langchain";
import { TavilySearch } from "@langchain/tavily";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { z } from "zod";

export const internetSearch = tool(
	async ({
		query,
		maxResults = 5,
		topic = "general",
		includeRawContent = false,
	}: {
		query: string;
		maxResults?: number;
		topic?: "general" | "news" | "finance";
		includeRawContent?: boolean;
	}) => {
		const hasTavilyKey =
			process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY.trim() !== "";

		if (hasTavilyKey) {
			// Use Tavily when API key is configured
			const tavilySearch = new TavilySearch({
				maxResults,
				tavilyApiKey: process.env.TAVILY_API_KEY,
				includeRawContent,
				topic,
			});
			return await tavilySearch._call({ query });
		}

		// Fallback to DuckDuckGo when Tavily is not configured
		// Note: DuckDuckGo doesn't support topic or includeRawContent parameters
		const duckDuckGoSearch = new DuckDuckGoSearch({
			maxResults,
		});
		return await duckDuckGoSearch._call(query);
	},
	{
		name: "internet_search",
		description: "Run a web search",
		schema: z.object({
			query: z.string().describe("The search query"),
			maxResults: z
				.number()
				.optional()
				.default(5)
				.describe("Maximum number of results to return"),
			topic: z
				.enum(["general", "news", "finance"])
				.optional()
				.default("general")
				.describe("Search topic category"),
			includeRawContent: z
				.boolean()
				.optional()
				.default(false)
				.describe("Whether to include raw content"),
		}),
	},
);
