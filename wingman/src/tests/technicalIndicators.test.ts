import { describe, expect, it } from "vitest";
import {
	buildTechnicalSnapshot,
	calculateAtr,
	calculateEma,
	calculateRsi,
} from "../tools/finance/technicalIndicators.js";

describe("Technical indicators", () => {
	it("returns null when data is insufficient", () => {
		expect(calculateEma([1, 2, 3], 5)).toBeNull();
		expect(calculateRsi([1, 2, 3], 5)).toBeNull();
		expect(calculateAtr([1, 2], [1, 2], [1, 2], 3)).toBeNull();
	});

	it("calculates EMA for constant series", () => {
		const values = Array.from({ length: 30 }, () => 10);
		expect(calculateEma(values, 20)).toBeCloseTo(10, 6);
	});

	it("calculates RSI extremes for monotonic series", () => {
		const up = Array.from({ length: 20 }, (_, i) => i + 1);
		const down = Array.from({ length: 20 }, (_, i) => 20 - i);
		expect(calculateRsi(up, 14)).toBe(100);
		expect(calculateRsi(down, 14)).toBe(0);
	});

	it("calculates ATR for stable ranges", () => {
		const highs = Array.from({ length: 20 }, () => 11);
		const lows = Array.from({ length: 20 }, () => 9);
		const closes = Array.from({ length: 20 }, () => 10);
		expect(calculateAtr(highs, lows, closes, 14)).toBeCloseTo(2, 6);
	});

	it("builds a snapshot with expected keys", () => {
		const closes = Array.from({ length: 250 }, () => 10);
		const highs = Array.from({ length: 250 }, () => 11);
		const lows = Array.from({ length: 250 }, () => 9);
		const snapshot = buildTechnicalSnapshot({ closes, highs, lows });

		expect(snapshot.lastClose).toBe(10);
		expect(snapshot.ema20).toBeCloseTo(10, 6);
		expect(snapshot.ema50).toBeCloseTo(10, 6);
		expect(snapshot.ema200).toBeCloseTo(10, 6);
		expect(snapshot.rsi14).toBe(100);
		expect(snapshot.atr14).toBeCloseTo(2, 6);
	});
});
