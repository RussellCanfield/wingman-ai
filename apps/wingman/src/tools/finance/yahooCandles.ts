export type CandleSeries = {
	c?: number[];
	h?: number[];
	l?: number[];
	o?: number[];
	t?: number[];
	v?: number[];
	s?: string;
	source?: "yahoo";
	error?: string;
};

export type YahooChartResponse = {
	chart?: {
		result?: Array<{
			timestamp?: number[];
			indicators?: {
				quote?: Array<{
					close?: Array<number | null>;
					high?: Array<number | null>;
					low?: Array<number | null>;
					open?: Array<number | null>;
					volume?: Array<number | null>;
				}>;
			};
		}>;
		error?: {
			description?: string;
			code?: string;
		};
	};
};

const SUPPORTED_INTRADAY_MINUTES = new Set([1, 2, 5, 15, 30, 60, 90]);

export const mapYahooInterval = (resolution?: string): string => {
	if (!resolution) return "1d";
	const normalized = resolution.trim().toUpperCase();
	if (normalized === "D") return "1d";
	if (normalized === "W") return "1wk";
	if (normalized === "M") return "1mo";

	if (/^\d+$/.test(normalized)) {
		const minutes = Number.parseInt(normalized, 10);
		if (SUPPORTED_INTRADAY_MINUTES.has(minutes)) {
			return `${minutes}m`;
		}
	}

	return "1d";
};

export const buildYahooChartUrl = ({
	baseUrl,
	symbol,
	from,
	to,
	interval,
	includePrePost,
}: {
	baseUrl: string;
	symbol: string;
	from: number;
	to: number;
	interval: string;
	includePrePost?: boolean;
}): string => {
	const url = new URL(`${baseUrl}/v8/finance/chart/${symbol}`);
	url.searchParams.set("period1", String(from));
	url.searchParams.set("period2", String(to));
	url.searchParams.set("interval", interval);
	url.searchParams.set("includePrePost", includePrePost ? "true" : "false");
	url.searchParams.set("events", "div,splits");
	return url.toString();
};

export const extractYahooCandles = (payload: YahooChartResponse): CandleSeries => {
	const error = payload.chart?.error;
	if (error) {
		return {
			s: "error",
			source: "yahoo",
			error: error.description || error.code || "Unknown Yahoo error",
		};
	}

	const result = payload.chart?.result?.[0];
	const timestamps = result?.timestamp ?? [];
	const quote = result?.indicators?.quote?.[0];

	if (!Array.isArray(timestamps) || timestamps.length === 0 || !quote) {
		return { s: "no_data", source: "yahoo" };
	}

	const closes = quote.close ?? [];
	const highs = quote.high ?? [];
	const lows = quote.low ?? [];
	const opens = quote.open ?? [];
	const volumes = quote.volume ?? [];

	const c: number[] = [];
	const h: number[] = [];
	const l: number[] = [];
	const o: number[] = [];
	const v: number[] = [];
	const t: number[] = [];

	for (let i = 0; i < timestamps.length; i += 1) {
		const close = closes[i];
		const high = highs[i];
		const low = lows[i];
		if (typeof close !== "number" || typeof high !== "number" || typeof low !== "number") {
			continue;
		}

		const open = opens[i];
		const volume = volumes[i];
		t.push(timestamps[i]);
		c.push(close);
		h.push(high);
		l.push(low);
		o.push(typeof open === "number" ? open : close);
		v.push(typeof volume === "number" ? volume : 0);
	}

	if (c.length === 0) {
		return { s: "no_data", source: "yahoo" };
	}

	return {
		c,
		h,
		l,
		o,
		t,
		v,
		s: "ok",
		source: "yahoo",
	};
};
