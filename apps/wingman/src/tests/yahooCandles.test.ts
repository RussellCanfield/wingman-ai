import { describe, expect, it } from "vitest";
import {
	buildYahooChartUrl,
	extractYahooCandles,
	mapYahooInterval,
} from "../tools/finance/yahooCandles.js";

describe("Yahoo candle helpers", () => {
	it("maps resolutions to supported Yahoo intervals", () => {
		expect(mapYahooInterval("D")).toBe("1d");
		expect(mapYahooInterval("W")).toBe("1wk");
		expect(mapYahooInterval("M")).toBe("1mo");
		expect(mapYahooInterval("60")).toBe("60m");
		expect(mapYahooInterval("15")).toBe("15m");
		expect(mapYahooInterval("7")).toBe("1d");
		expect(mapYahooInterval(undefined)).toBe("1d");
	});

	it("builds chart URL with query params", () => {
		const url = buildYahooChartUrl({
			baseUrl: "https://query1.finance.yahoo.com",
			symbol: "AAPL",
			from: 1700000000,
			to: 1700600000,
			interval: "1d",
			includePrePost: true,
		});
		expect(url).toContain("chart/AAPL");
		expect(url).toContain("period1=1700000000");
		expect(url).toContain("period2=1700600000");
		expect(url).toContain("interval=1d");
		expect(url).toContain("includePrePost=true");
	});

	it("normalizes Yahoo chart payload to candle series", () => {
		const payload = {
			chart: {
				result: [
					{
						timestamp: [1, 2, 3],
						indicators: {
							quote: [
								{
									close: [10, null, 12],
									high: [11, 12, 13],
									low: [9, 10, 11],
									open: [10, 11, null],
									volume: [100, null, 300],
								},
							],
						},
					},
				],
			},
		};

		const result = extractYahooCandles(payload);
		expect(result.s).toBe("ok");
		expect(result.source).toBe("yahoo");
		expect(result.t).toEqual([1, 3]);
		expect(result.c).toEqual([10, 12]);
		expect(result.h).toEqual([11, 13]);
		expect(result.l).toEqual([9, 11]);
		expect(result.o).toEqual([10, 12]);
		expect(result.v).toEqual([100, 300]);
	});

	it("returns no_data when payload is missing", () => {
		const result = extractYahooCandles({});
		expect(result.s).toBe("no_data");
	});
});
