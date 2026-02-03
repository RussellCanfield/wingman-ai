import { describe, expect, it } from "vitest";
import {
	DEFAULT_CANDLE_MAX_DAYS_DAILY,
	DEFAULT_CANDLE_MAX_DAYS_INTRADAY,
	resolveCandleRange,
} from "../tools/finance/candleRange.js";

const secondsPerDay = 24 * 60 * 60;
const fixedNow = new Date("2026-01-01T00:00:00Z");
const fixedEnd = Math.floor(fixedNow.getTime() / 1000);

describe("candle range caps", () => {
	it("defaults intraday lookback to the cap", () => {
		const range = resolveCandleRange({ resolution: "60", now: fixedNow });
		expect(range.maxLookbackDays).toBe(DEFAULT_CANDLE_MAX_DAYS_INTRADAY);
		expect(range.from).toBe(
			fixedEnd - DEFAULT_CANDLE_MAX_DAYS_INTRADAY * secondsPerDay,
		);
		expect(range.capped).toBe(false);
	});

	it("defaults daily lookback to the cap", () => {
		const range = resolveCandleRange({ resolution: "D", now: fixedNow });
		expect(range.maxLookbackDays).toBe(DEFAULT_CANDLE_MAX_DAYS_DAILY);
		expect(range.from).toBe(
			fixedEnd - DEFAULT_CANDLE_MAX_DAYS_DAILY * secondsPerDay,
		);
	});

	it("clamps intraday ranges that exceed the cap", () => {
		const range = resolveCandleRange({
			resolution: "15",
			now: fixedNow,
			from:
				fixedEnd -
				(DEFAULT_CANDLE_MAX_DAYS_INTRADAY + 10) * secondsPerDay,
		});
		expect(range.from).toBe(
			fixedEnd - DEFAULT_CANDLE_MAX_DAYS_INTRADAY * secondsPerDay,
		);
		expect(range.capped).toBe(true);
	});

	it("respects lookback days within the cap", () => {
		const range = resolveCandleRange({
			resolution: "1",
			now: fixedNow,
			lookbackDays: 30,
		});
		expect(range.from).toBe(fixedEnd - 30 * secondsPerDay);
		expect(range.capped).toBe(false);
	});
});
