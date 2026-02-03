import { describe, it, expect } from "vitest";

type CandleScenario = {
	label: string;
	symbol: string;
	resolution: string;
	lookbackDays: number;
};

const FINNHUB_BASE_URL =
	process.env.FINNHUB_BASE_URL?.trim() || "https://finnhub.io/api/v1";
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY?.trim();
const RUN_LIVE = process.env.FINNHUB_LIVE_TESTS === "1";

const describeLive = FINNHUB_API_KEY && RUN_LIVE ? describe : describe.skip;

const secondsPerDay = 24 * 60 * 60;

const buildCandleUrl = (scenario: CandleScenario): string => {
	const to = Math.floor(Date.now() / 1000);
	const from = to - scenario.lookbackDays * secondsPerDay;
	const url = new URL(`${FINNHUB_BASE_URL}/stock/candle`);
	url.searchParams.set("symbol", scenario.symbol);
	url.searchParams.set("resolution", scenario.resolution);
	url.searchParams.set("from", String(from));
	url.searchParams.set("to", String(to));
	url.searchParams.set("token", FINNHUB_API_KEY || "");
	return url.toString();
};

const scenarios: CandleScenario[] = [
	{ label: "daily-365", symbol: "AAPL", resolution: "D", lookbackDays: 365 },
	{ label: "daily-180", symbol: "AAPL", resolution: "D", lookbackDays: 180 },
	{ label: "daily-90", symbol: "AAPL", resolution: "D", lookbackDays: 90 },
	{ label: "hourly-180", symbol: "AAPL", resolution: "60", lookbackDays: 180 },
	{ label: "hourly-90", symbol: "AAPL", resolution: "60", lookbackDays: 90 },
	{ label: "hourly-30", symbol: "AAPL", resolution: "60", lookbackDays: 30 },
	{ label: "15m-30", symbol: "AAPL", resolution: "15", lookbackDays: 30 },
	{ label: "1m-7", symbol: "AAPL", resolution: "1", lookbackDays: 7 },
];

describeLive("Finnhub candle access (live)", () => {
	it("does not return 403 for supported ranges", async () => {
		const failures: string[] = [];

		for (const scenario of scenarios) {
			const url = buildCandleUrl(scenario);
			const response = await fetch(url, {
				headers: { "User-Agent": "wingman-finnhub-test" },
			});
			const body = await response.text();
			console.info(
				`Finnhub candle ${scenario.label} -> ${response.status}`,
			);

			if (response.status === 403) {
				failures.push(
					`403 for ${scenario.label} (${scenario.resolution}, ${scenario.lookbackDays}d): ${body.slice(0, 200)}`,
				);
				continue;
			}

			if (response.status === 429) {
				console.warn(`Rate limited for ${scenario.label}; skipping assert.`);
				continue;
			}

			expect(response.status).toBe(200);
		}

		if (failures.length > 0) {
			throw new Error(failures.join("\n"));
		}
	});
});
