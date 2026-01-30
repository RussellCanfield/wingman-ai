import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
	buildTechnicalSnapshot,
} from "./finance/technicalIndicators.js";
import { analyzeOptionStructure } from "./finance/optionsAnalytics.js";
import {
	DEFAULT_CANDLE_MAX_DAYS_DAILY,
	DEFAULT_CANDLE_MAX_DAYS_INTRADAY,
	resolveCandleRange,
} from "./finance/candleRange.js";
import {
	buildYahooChartUrl,
	extractYahooCandles,
	mapYahooInterval,
	type CandleSeries,
	type YahooChartResponse,
} from "./finance/yahooCandles.js";

const DEFAULT_RATE_LIMIT_PER_MIN = 60;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_BACKOFF_BASE_MS = 500;
const DEFAULT_BACKOFF_MAX_MS = 8_000;

const FINNHUB_BASE_URL =
	process.env.FINNHUB_BASE_URL?.trim() || "https://finnhub.io/api/v1";
const YAHOO_FINANCE_BASE_URL =
	process.env.YAHOO_FINANCE_BASE_URL?.trim() ||
	"https://query1.finance.yahoo.com";
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY?.trim();
const candleProvider =
	process.env.FINNHUB_CANDLES_PROVIDER?.trim().toLowerCase() || "yahoo";
const yahooIncludePrePost =
	process.env.YAHOO_INCLUDE_PREPOST?.trim() === "1";

if (!FINNHUB_API_KEY) {
	console.error("FINNHUB_API_KEY is required to run the MCP finance server.");
	process.exit(1);
}

const tier = process.env.FINNHUB_TIER?.trim().toLowerCase();
const tierOverridesRaw = process.env.FINNHUB_TIER_LIMITS;
let tierOverrides: Record<string, number> = {};

if (tierOverridesRaw) {
	try {
		const parsed = JSON.parse(tierOverridesRaw) as Record<string, number>;
		if (parsed && typeof parsed === "object") {
			tierOverrides = parsed;
		}
	} catch {
		console.error(
			"Invalid FINNHUB_TIER_LIMITS JSON. Expected format: {\"free\":60,\"pro\":300}",
		);
	}
}

const tierLimit = (() => {
	if (!tier) return undefined;
	const defaults: Record<string, number> = {
		free: 60,
	};
	return tierOverrides[tier] ?? defaults[tier];
})();

const rateLimitPerMin =
	Number.parseInt(process.env.FINNHUB_RATE_LIMIT_PER_MIN || "", 10) ||
	tierLimit ||
	DEFAULT_RATE_LIMIT_PER_MIN;

const windowMs =
	Number.parseInt(process.env.FINNHUB_RATE_LIMIT_WINDOW_MS || "", 10) ||
	DEFAULT_WINDOW_MS;

const maxRetries =
	Number.parseInt(process.env.FINNHUB_MAX_RETRIES || "", 10) ||
	DEFAULT_MAX_RETRIES;
const backoffBaseMs =
	Number.parseInt(process.env.FINNHUB_BACKOFF_BASE_MS || "", 10) ||
	DEFAULT_BACKOFF_BASE_MS;
const backoffMaxMs =
	Number.parseInt(process.env.FINNHUB_BACKOFF_MAX_MS || "", 10) ||
	DEFAULT_BACKOFF_MAX_MS;

const parsePositiveInt = (value?: string): number | undefined => {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const maxIntradayDays =
	parsePositiveInt(process.env.FINNHUB_CANDLE_MAX_DAYS_INTRADAY) ??
	DEFAULT_CANDLE_MAX_DAYS_INTRADAY;
const maxDailyDays =
	parsePositiveInt(process.env.FINNHUB_CANDLE_MAX_DAYS_DAILY) ??
	DEFAULT_CANDLE_MAX_DAYS_DAILY;
const candleCapSummary = `Intraday capped to ${maxIntradayDays}d; daily+ capped to ${maxDailyDays}d.`;
const candleSourceSummary =
	candleProvider === "finnhub"
		? "Source: Finnhub."
		: candleProvider === "auto"
			? "Source: Finnhub with Yahoo fallback."
			: "Source: Yahoo Finance (best effort).";
const candleSessionSummary = yahooIncludePrePost
	? "Includes pre/post market data."
	: "Regular session only.";

type FinnhubCandleResponse = {
	c?: number[];
	h?: number[];
	l?: number[];
	o?: number[];
	t?: number[];
	v?: number[];
	s?: string;
	error?: string;
};

class RateLimiter {
	private tokens: number;
	private windowStart: number;
	private queue: Promise<void> = Promise.resolve();

	constructor(
		private limit: number,
		private windowDurationMs: number,
	) {
		this.tokens = limit;
		this.windowStart = Date.now();
	}

	async wait(): Promise<void> {
		let release: () => void;
		const previous = this.queue;
		this.queue = new Promise<void>((resolve) => {
			release = resolve;
		});

		await previous;
		try {
			await this.acquire();
		} finally {
			release!();
		}
	}

	private async acquire(): Promise<void> {
		this.resetIfNeeded();
		if (this.tokens > 0) {
			this.tokens -= 1;
			return;
		}

		const waitMs = this.windowStart + this.windowDurationMs - Date.now();
		if (waitMs > 0) {
			await sleep(waitMs);
		}
		this.resetWindow();
		this.tokens -= 1;
	}

	private resetIfNeeded(): void {
		if (Date.now() - this.windowStart >= this.windowDurationMs) {
			this.resetWindow();
		}
	}

	private resetWindow(): void {
		this.windowStart = Date.now();
		this.tokens = this.limit;
	}
}

const rateLimiter = new RateLimiter(rateLimitPerMin, windowMs);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildUrl = (path: string, params: Record<string, string>) => {
	const url = new URL(`${FINNHUB_BASE_URL}${path}`);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== "") {
			url.searchParams.set(key, value);
		}
	}
	url.searchParams.set("token", FINNHUB_API_KEY!);
	return url.toString();
};


const parseRetryAfter = (value: string | null): number | null => {
	if (!value) return null;
	const seconds = Number.parseFloat(value);
	if (!Number.isNaN(seconds)) {
		return Math.max(0, seconds * 1000);
	}
	const parsed = Date.parse(value);
	if (!Number.isNaN(parsed)) {
		return Math.max(0, parsed - Date.now());
	}
	return null;
};

const fetchWithBackoff = async (url: string): Promise<Response> => {
	let attempt = 0;
	let delay = backoffBaseMs;
	for (;;) {
		const response = await fetch(url, {
			headers: {
				"User-Agent": "wingman-mcp-finance",
			},
		});

		if (response.status !== 429) {
			return response;
		}

		attempt += 1;
		if (attempt > maxRetries) {
			return response;
		}

		const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
		const jitter = Math.round(Math.random() * 250);
		const waitMs = Math.min(backoffMaxMs, retryAfter ?? delay + jitter);
		await sleep(waitMs);
		delay = Math.min(backoffMaxMs, delay * 2);
	}
};

const fetchFinnhub = async <T = unknown>(
	path: string,
	params: Record<string, string>,
): Promise<T> => {
	await rateLimiter.wait();
	const url = buildUrl(path, params);
	const response = await fetchWithBackoff(url);

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`Finnhub error ${response.status}: ${errorBody}`);
	}

	return (await response.json()) as T;
};

const fetchYahooCandles = async ({
	symbol,
	resolution,
	from,
	to,
}: {
	symbol: string;
	resolution?: string;
	from: number;
	to: number;
}): Promise<CandleSeries> => {
	const interval = mapYahooInterval(resolution);
	const url = buildYahooChartUrl({
		baseUrl: YAHOO_FINANCE_BASE_URL,
		symbol,
		from,
		to,
		interval,
		includePrePost: yahooIncludePrePost,
	});
	const response = await fetchWithBackoff(url);

	if (!response.ok) {
		const errorBody = await response.text();
		return {
			s: "error",
			source: "yahoo",
			error: `Yahoo error ${response.status}: ${errorBody}`,
		};
	}

	const payload = (await response.json()) as YahooChartResponse;
	return extractYahooCandles(payload);
};

const isFinnhubForbidden = (error: unknown): boolean =>
	error instanceof Error && /\b403\b/.test(error.message);

const fetchCandlesWithFallback = async ({
	symbol,
	resolution,
	from,
	to,
}: {
	symbol: string;
	resolution?: string;
	from: number;
	to: number;
}): Promise<{ data: FinnhubCandleResponse | CandleSeries; source: "finnhub" | "yahoo" }> => {
	if (candleProvider === "yahoo") {
		const data = await fetchYahooCandles({ symbol, resolution, from, to });
		return { data, source: "yahoo" };
	}

	if (candleProvider === "finnhub") {
		const data = await fetchFinnhub<FinnhubCandleResponse>("/stock/candle", {
			symbol,
			resolution: resolution || "D",
			from: String(from),
			to: String(to),
		});
		return { data, source: "finnhub" };
	}

	try {
		const data = await fetchFinnhub<FinnhubCandleResponse>("/stock/candle", {
			symbol,
			resolution: resolution || "D",
			from: String(from),
			to: String(to),
		});
		return { data, source: "finnhub" };
	} catch (error) {
		if (!isFinnhubForbidden(error)) {
			throw error;
		}
		const data = await fetchYahooCandles({ symbol, resolution, from, to });
		return { data, source: "yahoo" };
	}
};

const toResult = (data: unknown) => ({
	content: [
		{
			type: "text" as const,
			text: JSON.stringify(data, null, 2),
		},
	],
	structuredContent: { data },
});

const server = new McpServer({
	name: "wingman-finance",
	version: "0.1.0",
});

server.registerTool(
	"finnhub.symbolSearch",
	{
		title: "Finnhub Symbol Search",
		description: "Search for symbols or companies by query.",
		inputSchema: z.object({
			query: z.string().min(1),
		}),
	},
	async ({ query }) => {
		const data = await fetchFinnhub("/search", { q: query });
		return toResult(data);
	},
);

server.registerTool(
	"finnhub.quote",
	{
		title: "Finnhub Quote",
		description: "Get the latest quote for a symbol.",
		inputSchema: z.object({
			symbol: z.string().min(1),
		}),
	},
	async ({ symbol }) => {
		const data = await fetchFinnhub("/quote", { symbol });
		return toResult(data);
	},
);

server.registerTool(
	"finnhub.companyProfile",
	{
		title: "Finnhub Company Profile",
		description: "Get company profile data for a symbol.",
		inputSchema: z.object({
			symbol: z.string().min(1),
		}),
	},
	async ({ symbol }) => {
		const data = await fetchFinnhub("/stock/profile2", { symbol });
		return toResult(data);
	},
);

server.registerTool(
	"finnhub.financials",
	{
		title: "Finnhub Financial Metrics",
		description: "Get financial metrics (including P/E) for a symbol.",
		inputSchema: z.object({
			symbol: z.string().min(1),
			metric: z.string().optional().default("all"),
		}),
	},
	async ({ symbol, metric }) => {
		const data = await fetchFinnhub("/stock/metric", {
			symbol,
			metric: metric || "all",
		});
		return toResult(data);
	},
);

server.registerTool(
	"finnhub.earnings",
	{
		title: "Finnhub Earnings",
		description: "Get earnings history for a symbol.",
		inputSchema: z.object({
			symbol: z.string().min(1),
			limit: z.number().int().min(1).max(20).optional(),
		}),
	},
	async ({ symbol, limit }) => {
		const data = await fetchFinnhub("/stock/earnings", {
			symbol,
			...(limit ? { limit: String(limit) } : {}),
		});
		return toResult(data);
	},
);

server.registerTool(
	"finnhub.news",
	{
		title: "Finnhub Company News",
		description: "Get recent company news for a symbol.",
		inputSchema: z.object({
			symbol: z.string().min(1),
			from: z.string().optional(),
			to: z.string().optional(),
		}),
	},
	async ({ symbol, from, to }) => {
		const toDate = to || new Date().toISOString().slice(0, 10);
		let fromDate = from;
		if (!fromDate) {
			const start = new Date();
			start.setDate(start.getDate() - 7);
			fromDate = start.toISOString().slice(0, 10);
		}
		const data = await fetchFinnhub("/company-news", {
			symbol,
			from: fromDate,
			to: toDate,
		});
		return toResult(data);
	},
);

server.registerTool(
	"finnhub.marketNews",
	{
		title: "Finnhub Market News",
		description: "Get broad market news (general category) for theme detection.",
		inputSchema: z.object({
			category: z.string().min(1).optional().default("general"),
		}),
	},
	async ({ category }) => {
		const data = await fetchFinnhub("/news", {
			category: category || "general",
		});
		return toResult(data);
	},
);

server.registerTool(
	"finnhub.peers",
	{
		title: "Finnhub Stock Peers",
		description: "Get peer symbols for a company.",
		inputSchema: z.object({
			symbol: z.string().min(1),
		}),
	},
	async ({ symbol }) => {
		const data = await fetchFinnhub("/stock/peers", { symbol });
		return toResult(data);
	},
);

server.registerTool(
	"finnhub.candles",
	{
		title: "Finnhub Candles",
		description: `Get OHLCV candles for a symbol. ${candleCapSummary} ${candleSourceSummary} ${candleSessionSummary}`,
		inputSchema: z.object({
			symbol: z.string().min(1),
			resolution: z.string().optional().default("D"),
			from: z.number().int().optional(),
			to: z.number().int().optional(),
			lookbackDays: z.number().int().positive().optional(),
		}),
	},
	async ({ symbol, resolution, from, to, lookbackDays }) => {
		const range = resolveCandleRange({
			from,
			to,
			lookbackDays,
			resolution,
			maxIntradayDays,
			maxDailyDays,
		});
		const { data, source } = await fetchCandlesWithFallback({
			symbol,
			resolution,
			from: range.from,
			to: range.to,
		});
		const result =
			source === "yahoo" && !(data as CandleSeries).source
				? { ...data, source }
				: data;
		return toResult(result);
	},
);

server.registerTool(
	"finnhub.technicalSnapshot",
	{
		title: "Finnhub Technical Snapshot",
		description: `Fetch candles and compute RSI/EMA/ATR locally. ${candleCapSummary} ${candleSourceSummary} ${candleSessionSummary}`,
		inputSchema: z.object({
			symbol: z.string().min(1),
			resolution: z.string().optional().default("D"),
			from: z.number().int().optional(),
			to: z.number().int().optional(),
			lookbackDays: z.number().int().positive().optional(),
		}),
	},
	async ({ symbol, resolution, from, to, lookbackDays }) => {
		const range = resolveCandleRange({
			from,
			to,
			lookbackDays,
			resolution,
			maxIntradayDays,
			maxDailyDays,
		});
		const { data, source } = await fetchCandlesWithFallback({
			symbol,
			resolution,
			from: range.from,
			to: range.to,
		});

		if (!data || data.s !== "ok" || !Array.isArray(data.c)) {
			return toResult({
				symbol,
				source,
				status: data?.s ?? "no_data",
				error: (data as CandleSeries | FinnhubCandleResponse).error,
				from: range.from,
				to: range.to,
			});
		}

		const snapshot = buildTechnicalSnapshot({
			closes: data.c,
			highs: data.h ?? [],
			lows: data.l ?? [],
		});

		return toResult({
			symbol,
			resolution: resolution || "D",
			from: range.from,
			to: range.to,
			source,
			status: data.s,
			points: data.c.length,
			lastTimestamp: data.t?.at(-1) ?? null,
			...snapshot,
		});
	},
);

server.registerTool(
	"finnhub.optionChain",
	{
		title: "Finnhub Option Chain",
		description: "Get option chain data for a symbol (date optional).",
		inputSchema: z.object({
			symbol: z.string().min(1),
			date: z.string().optional(),
		}),
	},
	async ({ symbol, date }) => {
		const data = await fetchFinnhub("/stock/option-chain", {
			symbol,
			...(date ? { date } : {}),
		});
		return toResult(data);
	},
);

server.registerTool(
	"options.analyze",
	{
		title: "Options Structure Analyzer",
		description:
			"Compute payoff metrics and optional Greeks for an options structure using supplied leg prices.",
		inputSchema: z.object({
			underlyingPrice: z.number().positive(),
			daysToExpiry: z.number().positive().optional(),
			riskFreeRate: z.number().optional().default(0),
			dividendYield: z.number().optional().default(0),
			legs: z
				.array(
					z.object({
						type: z.enum(["call", "put"]),
						side: z.enum(["buy", "sell"]),
						strike: z.number().positive(),
						premium: z.number().nonnegative(),
						qty: z.number().int().positive().optional(),
						contractMultiplier: z.number().positive().optional(),
						impliedVol: z.number().positive().optional(),
					}),
				)
				.min(1),
		}),
	},
	async (input) => {
		const data = analyzeOptionStructure(input);
		return toResult(data);
	},
);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error(
	`wingman-mcp-finance ready | Finnhub rate limit: ${rateLimitPerMin}/min | base: ${FINNHUB_BASE_URL} | candle caps: ${candleCapSummary} | candle source: ${candleProvider} | sessions: ${candleSessionSummary}`,
);
