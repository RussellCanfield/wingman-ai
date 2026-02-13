import { tool } from "langchain";
import { search as duckDuckGoSearch } from "duck-duck-scrape";
import { ChatOpenAI } from "@langchain/openai";
import * as z from "zod";
import type { SearchConfig } from "../../cli/config/schema.js";

const DEFAULT_DDG_MIN_DELAY_MS = 2000;
const DEFAULT_DDG_MAX_RETRIES = 3;
const DEFAULT_DDG_BACKOFF_BASE_MS = 500;
const DEFAULT_DDG_BACKOFF_MAX_MS = 4000;
const DEFAULT_DDG_BACKOFF_JITTER_MS = 200;

const parsePositiveInt = (value?: string): number | undefined => {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const parseNonNegativeInt = (value?: string): number | undefined => {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const ddgMinDelayMs =
	parseNonNegativeInt(process.env.WINGMAN_DDG_MIN_DELAY_MS) ??
	DEFAULT_DDG_MIN_DELAY_MS;
const ddgMaxRetries =
	parsePositiveInt(process.env.WINGMAN_DDG_MAX_RETRIES) ??
	DEFAULT_DDG_MAX_RETRIES;
const ddgBackoffBaseMs =
	parseNonNegativeInt(process.env.WINGMAN_DDG_BACKOFF_BASE_MS) ??
	DEFAULT_DDG_BACKOFF_BASE_MS;
const ddgBackoffMaxMs = Math.max(
	ddgBackoffBaseMs,
	parseNonNegativeInt(process.env.WINGMAN_DDG_BACKOFF_MAX_MS) ??
		DEFAULT_DDG_BACKOFF_MAX_MS,
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class SerializedRateLimiter {
	private queue: Promise<void> = Promise.resolve();
	private lastAt = 0;

	constructor(private minDelayMs: number) {}

	async run<T>(fn: () => Promise<T>): Promise<T> {
		let release: (() => void) | undefined;
		const previous = this.queue;
		this.queue = new Promise<void>((resolve) => {
			release = resolve;
		});

		await previous;

		try {
			const now = Date.now();
			const waitMs = Math.max(0, this.minDelayMs - (now - this.lastAt));
			if (waitMs > 0) {
				await sleep(waitMs);
			}
			this.lastAt = Date.now();
			return await fn();
		} finally {
			this.lastAt = Date.now();
			if (release) {
				release();
			}
		}
	}
}

const ddgRateLimiter = new SerializedRateLimiter(ddgMinDelayMs);

const isDdgAnomalyError = (error: unknown): boolean => {
	let message: string;
	if (error instanceof Error) {
		message = error.message;
	} else if (typeof error === "string") {
		message = error;
	} else {
		try {
			message = JSON.stringify(error);
		} catch {
			message = String(error);
		}
	}
	return /anomaly|too quickly|rate limit|too many requests|429/i.test(message);
};

const formatDdgError = (error: unknown, attempts: number): Error =>
	new Error(
		`DuckDuckGo search was rate-limited (detected anomaly). ` +
			`Tried ${attempts} attempt${attempts === 1 ? "" : "s"}. ` +
			"Wait a few seconds, increase WINGMAN_DDG_MIN_DELAY_MS, " +
			"or switch to the Perplexity provider in wingman.config.json.",
		{ cause: error },
	);

async function runDuckDuckGoSearch(query: string, maxResults: number) {
	let attempt = 0;
	let delayMs = ddgBackoffBaseMs;

	while (true) {
		try {
			return await ddgRateLimiter.run(async () => {
				const { results } = await duckDuckGoSearch(query);
				return JSON.stringify(
					results
						.map((result) => ({
							title: result.title,
							link: result.url,
							snippet: result.description,
						}))
						.slice(0, maxResults),
				);
			});
		} catch (error) {
			const shouldRetry = isDdgAnomalyError(error);
			if (!shouldRetry || attempt >= ddgMaxRetries) {
				if (shouldRetry) {
					throw formatDdgError(error, attempt + 1);
				}
				throw error;
			}

			const jitter =
				DEFAULT_DDG_BACKOFF_JITTER_MS > 0
					? Math.floor(Math.random() * DEFAULT_DDG_BACKOFF_JITTER_MS)
					: 0;
			const waitMs = Math.min(ddgBackoffMaxMs, delayMs + jitter);
			if (waitMs > 0) {
				await sleep(waitMs);
			}
			delayMs = Math.min(ddgBackoffMaxMs, delayMs * 2);
			attempt += 1;
		}
	}
}

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
			const limit = queryMaxResults ?? maxResults;
			return await runDuckDuckGoSearch(query, limit);
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
		temperature: 1,
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
