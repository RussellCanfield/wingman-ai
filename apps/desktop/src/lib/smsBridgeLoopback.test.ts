import { describe, expect, test } from "bun:test";
import {
	consumeSmsBridgeLoopback,
	isSmsBridgeSelfEcho,
	normalizeSmsBridgeComparableText,
	rememberSmsBridgeOutbound,
	type SmsBridgeLoopbackRecord,
} from "./smsBridgeLoopback.js";

describe("smsBridgeLoopback", () => {
	test("matches and consumes one recent outbound record", () => {
		const now = 10_000;
		let records: SmsBridgeLoopbackRecord[] = [];
		records = rememberSmsBridgeOutbound(
			records,
			{ handle: "+15555550000", text: "Hello there" },
			{ now, ttlMs: 60_000 },
		);
		const consumed = consumeSmsBridgeLoopback(
			records,
			{ handle: "+15555550000", text: "Hello there" },
			{ now: now + 1_000, ttlMs: 60_000 },
		);
		expect(consumed.matched).toBe(true);
		expect(consumed.records).toHaveLength(0);
	});

	test("normalizes casing and whitespace for matching", () => {
		const now = 20_000;
		let records: SmsBridgeLoopbackRecord[] = [];
		records = rememberSmsBridgeOutbound(
			records,
			{ handle: " +15555550000 ", text: "Hello    there" },
			{ now, ttlMs: 60_000 },
		);
		const consumed = consumeSmsBridgeLoopback(
			records,
			{ handle: "+15555550000", text: " hello there " },
			{ now: now + 1_000, ttlMs: 60_000 },
		);
		expect(consumed.matched).toBe(true);
		expect(consumed.records).toHaveLength(0);
	});

	test("does not match expired outbound records", () => {
		const now = 30_000;
		let records: SmsBridgeLoopbackRecord[] = [];
		records = rememberSmsBridgeOutbound(
			records,
			{ handle: "+15555550000", text: "Hello there" },
			{ now, ttlMs: 2_000 },
		);
		const consumed = consumeSmsBridgeLoopback(
			records,
			{ handle: "+15555550000", text: "Hello there" },
			{ now: now + 5_000, ttlMs: 2_000 },
		);
		expect(consumed.matched).toBe(false);
		expect(consumed.records).toHaveLength(0);
	});

	test("consumes one match at a time for duplicate chunks", () => {
		const now = 40_000;
		let records: SmsBridgeLoopbackRecord[] = [];
		records = rememberSmsBridgeOutbound(
			records,
			{ handle: "+15555550000", text: "same chunk" },
			{ now, ttlMs: 60_000 },
		);
		records = rememberSmsBridgeOutbound(
			records,
			{ handle: "+15555550000", text: "same chunk" },
			{ now: now + 10, ttlMs: 60_000 },
		);

		const first = consumeSmsBridgeLoopback(
			records,
			{ handle: "+15555550000", text: "same chunk" },
			{ now: now + 500, ttlMs: 60_000 },
		);
		expect(first.matched).toBe(true);
		expect(first.records).toHaveLength(1);

		const second = consumeSmsBridgeLoopback(
			first.records,
			{ handle: "+15555550000", text: "same chunk" },
			{ now: now + 600, ttlMs: 60_000 },
		);
		expect(second.matched).toBe(true);
		expect(second.records).toHaveLength(0);
	});

	test("normalizes comparable text consistently", () => {
		expect(normalizeSmsBridgeComparableText("  HELLO    there ")).toBe(
			"hello there",
		);
	});

	test("detects normalized self-echo text", () => {
		expect(
			isSmsBridgeSelfEcho({
				inboundText: " Hello there ",
				outboundText: "hello   there",
			}),
		).toBe(true);
		expect(
			isSmsBridgeSelfEcho({
				inboundText: "Hello there",
				outboundText: "different",
			}),
		).toBe(false);
	});
});
