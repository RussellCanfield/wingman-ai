import { describe, expect, it } from "vitest";
import { runWithInFlightGuard } from "./inFlight";

describe("runWithInFlightGuard", () => {
	it("returns the same pending promise for concurrent calls", async () => {
		let resolver: ((value: string) => void) | null = null;
		const inFlight = { current: null as Promise<string> | null };
		let calls = 0;

		const task = () => {
			calls += 1;
			return new Promise<string>((resolve) => {
				resolver = resolve;
			});
		};

		const first = runWithInFlightGuard(inFlight, task);
		const second = runWithInFlightGuard(inFlight, task);
		expect(first).toBe(second);
		expect(calls).toBe(1);
		resolver?.("ok");
		await expect(first).resolves.toBe("ok");
	});

	it("clears in-flight state after resolve", async () => {
		const inFlight = { current: null as Promise<number> | null };
		let calls = 0;
		const task = async () => {
			calls += 1;
			return calls;
		};

		await expect(runWithInFlightGuard(inFlight, task)).resolves.toBe(1);
		expect(inFlight.current).toBeNull();
		await expect(runWithInFlightGuard(inFlight, task)).resolves.toBe(2);
		expect(calls).toBe(2);
	});

	it("clears in-flight state after rejection", async () => {
		const inFlight = { current: null as Promise<void> | null };
		let shouldFail = true;

		const task = async () => {
			if (shouldFail) {
				throw new Error("boom");
			}
		};

		await expect(runWithInFlightGuard(inFlight, task)).rejects.toThrow("boom");
		expect(inFlight.current).toBeNull();
		shouldFail = false;
		await expect(runWithInFlightGuard(inFlight, task)).resolves.toBeUndefined();
	});
});
