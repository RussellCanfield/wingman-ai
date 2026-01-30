import { describe, expect, it } from "vitest";
import { analyzeOptionStructure } from "./optionsAnalytics.js";

describe("optionsAnalytics", () => {
	it("computes long call payoff metrics", () => {
		const result = analyzeOptionStructure({
			underlyingPrice: 100,
			legs: [
				{
					type: "call",
					side: "buy",
					strike: 100,
					premium: 5,
				},
			],
		});

		expect(result.netDebit).toBeCloseTo(500, 2);
		expect(result.maxProfit.unbounded).toBe(true);
		expect(result.maxLoss.unbounded).toBe(false);
		expect(result.maxLoss.usd).toBeCloseTo(500, 2);
		expect(result.breakevens).toContain(105);
	});

	it("computes bull call debit spread metrics", () => {
		const result = analyzeOptionStructure({
			underlyingPrice: 100,
			legs: [
				{
					type: "call",
					side: "buy",
					strike: 100,
					premium: 5,
				},
				{
					type: "call",
					side: "sell",
					strike: 110,
					premium: 2,
				},
			],
		});

		expect(result.netDebit).toBeCloseTo(300, 2);
		expect(result.maxProfit.unbounded).toBe(false);
		expect(result.maxProfit.usd).toBeCloseTo(700, 2);
		expect(result.maxLoss.usd).toBeCloseTo(300, 2);
		expect(result.breakevens).toContain(103);
	});

	it("computes bear call credit spread metrics", () => {
		const result = analyzeOptionStructure({
			underlyingPrice: 100,
			legs: [
				{
					type: "call",
					side: "sell",
					strike: 100,
					premium: 5,
				},
				{
					type: "call",
					side: "buy",
					strike: 110,
					premium: 2,
				},
			],
		});

		expect(result.netCredit).toBeCloseTo(300, 2);
		expect(result.maxProfit.unbounded).toBe(false);
		expect(result.maxProfit.usd).toBeCloseTo(300, 2);
		expect(result.maxLoss.usd).toBeCloseTo(700, 2);
		expect(result.breakevens).toContain(103);
	});

	it("flags unbounded loss for naked short call", () => {
		const result = analyzeOptionStructure({
			underlyingPrice: 100,
			legs: [
				{
					type: "call",
					side: "sell",
					strike: 100,
					premium: 5,
				},
			],
		});

		expect(result.maxLoss.unbounded).toBe(true);
		expect(result.maxProfit.unbounded).toBe(false);
		expect(result.maxProfit.usd).toBeCloseTo(500, 2);
		expect(result.breakevens).toContain(105);
	});

	it("computes greeks when inputs provided", () => {
		const result = analyzeOptionStructure({
			underlyingPrice: 100,
			daysToExpiry: 30,
			riskFreeRate: 0.01,
			legs: [
				{
					type: "call",
					side: "buy",
					strike: 100,
					premium: 5,
					impliedVol: 0.2,
				},
			],
		});

		expect(result.greeks.status).toBe("ok");
		expect(result.greeks.delta).toBeGreaterThan(0);
		expect(result.greeks.theta).toBeLessThan(0);
	});

	it("returns insufficient-data greeks when missing IV", () => {
		const result = analyzeOptionStructure({
			underlyingPrice: 100,
			daysToExpiry: 30,
			legs: [
				{
					type: "call",
					side: "buy",
					strike: 100,
					premium: 5,
				},
			],
		});

		expect(result.greeks.status).toBe("insufficient-data");
		expect(result.greeks.legsMissing).toBe(1);
	});
});
