import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = { ...process.env };

const restoreEnv = () => {
	for (const key of Object.keys(process.env)) {
		if (!(key in originalEnv)) {
			delete process.env[key];
		}
	}
	for (const [key, value] of Object.entries(originalEnv)) {
		process.env[key] = value;
	}
};

const loadSearchModule = async (
	overrides: Record<string, string | undefined>,
) => {
	for (const [key, value] of Object.entries(overrides)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	vi.resetModules();
	const callMock = vi.fn();
	vi.doMock("@langchain/community/tools/duckduckgo_search", () => ({
		DuckDuckGoSearch: class {
			_call = callMock;
			constructor() {}
		},
	}));
	const module = await import("../tools/internet_search");
	return { ...module, callMock };
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	restoreEnv();
});

describe("Internet search tool (DuckDuckGo)", () => {
	it("retries on DDG anomaly and succeeds", async () => {
		const { createInternetSearchTool, callMock } = await loadSearchModule({
			WINGMAN_DDG_MIN_DELAY_MS: "0",
			WINGMAN_DDG_BACKOFF_BASE_MS: "1",
			WINGMAN_DDG_BACKOFF_MAX_MS: "1",
			WINGMAN_DDG_MAX_RETRIES: "2",
		});

		callMock
			.mockRejectedValueOnce(
				new Error(
					"DDG detected an anomaly in the request, you are likely making requests too quickly.",
				),
			)
			.mockResolvedValueOnce("ok");

		const tool = createInternetSearchTool({
			provider: "duckduckgo",
			maxResults: 3,
		});

		const resultPromise = tool.invoke({ query: "test" });
		const expectation = expect(resultPromise).resolves.toBe("ok");
		await vi.runAllTimersAsync();
		await expectation;
		expect(callMock).toHaveBeenCalledTimes(2);
	});

	it("throws a friendly error after retry exhaustion", async () => {
		const { createInternetSearchTool, callMock } = await loadSearchModule({
			WINGMAN_DDG_MIN_DELAY_MS: "0",
			WINGMAN_DDG_BACKOFF_BASE_MS: "1",
			WINGMAN_DDG_BACKOFF_MAX_MS: "1",
			WINGMAN_DDG_MAX_RETRIES: "1",
		});

		callMock.mockRejectedValue(
			new Error(
				"DDG detected an anomaly in the request, you are likely making requests too quickly.",
			),
		);

		const tool = createInternetSearchTool({
			provider: "duckduckgo",
			maxResults: 3,
		});

		const resultPromise = tool.invoke({ query: "test" });
		const expectation = expect(resultPromise).rejects.toThrow(/rate-limited|anomaly/i);
		await vi.runAllTimersAsync();
		await expectation;
		expect(callMock).toHaveBeenCalledTimes(2);
	});

	it("does not retry on non-anomaly errors", async () => {
		const { createInternetSearchTool, callMock } = await loadSearchModule({
			WINGMAN_DDG_MIN_DELAY_MS: "0",
			WINGMAN_DDG_BACKOFF_BASE_MS: "1",
			WINGMAN_DDG_BACKOFF_MAX_MS: "1",
			WINGMAN_DDG_MAX_RETRIES: "2",
		});

		callMock.mockRejectedValue(new Error("network down"));

		const tool = createInternetSearchTool({
			provider: "duckduckgo",
			maxResults: 3,
		});

		const resultPromise = tool.invoke({ query: "test" });
		const expectation = expect(resultPromise).rejects.toThrow("network down");
		await vi.runAllTimersAsync();
		await expectation;
		expect(callMock).toHaveBeenCalledTimes(1);
	});
});
