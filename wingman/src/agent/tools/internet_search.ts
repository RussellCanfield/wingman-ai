import { tool } from "langchain";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { SearchConfig } from "../../cli/config/schema.js";

/**
 * Create a DuckDuckGo search tool
 */
function createDuckDuckGoTool(maxResults: number) {
	return tool(
		async ({
			query,
			maxResults: queryMaxResults,
		}: {
			query: string;
			maxResults?: number;
		}) => {
			const search = new DuckDuckGoSearch({
				maxResults: queryMaxResults ?? maxResults,
			});
			return await search._call(query);
		},
		{
			name: "internet_search",
			description: "Run a web search using DuckDuckGo",
			schema: z.object({
				query: z.string().describe("The search query"),
				maxResults: z
					.number()
					.optional()
					.default(maxResults)
					.describe("Maximum number of results to return"),
			}),
		},
	);
}

/**
 * Create a Perplexity search tool via OpenRouter
 */
function createPerplexityTool(maxResults: number) {
	if (!process.env.OPENROUTER_API_KEY) {
		throw new Error(
			"Perplexity search requires OPENROUTER_API_KEY environment variable. " +
				"Get your key at https://openrouter.ai/ or switch to DuckDuckGo in wingman.config.json",
		);
	}

	const model = new ChatOpenAI({
		model: "perplexity/sonar",
		temperature: 0,
		configuration: {
			baseURL: "https://openrouter.ai/api/v1",
			apiKey: process.env.OPENROUTER_API_KEY,
		},
	});

	return tool(
		async ({
			query,
			maxResults: queryMaxResults,
		}: {
			query: string;
			maxResults?: number;
		}) => {
			const limit = queryMaxResults ?? maxResults;
			const prompt = `Search for: ${query}\n\nProvide up to ${limit} relevant results with citations.`;
			const response = await model.invoke(prompt);
			return response.content;
		},
		{
			name: "internet_search",
			description:
				"Run a web search using Perplexity Sonar with built-in citations",
			schema: z.object({
				query: z.string().describe("The search query"),
				maxResults: z
					.number()
					.optional()
					.default(maxResults)
					.describe("Maximum number of results to return"),
			}),
		},
	);
}

/**
 * Create an internet search tool based on configuration
 */
export function createInternetSearchTool(config: SearchConfig) {
	const { provider, maxResults = 5 } = config;

	switch (provider) {
		case "duckduckgo":
			return createDuckDuckGoTool(maxResults);
		case "perplexity":
			return createPerplexityTool(maxResults);
		default:
			throw new Error(`Unknown search provider: ${provider}`);
	}
}

// Default export for backward compatibility (uses DuckDuckGo)
export const internetSearch = createDuckDuckGoTool(5);
