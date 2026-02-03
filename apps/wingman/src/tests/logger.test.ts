import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	WingmanLogger,
	SilentLogger,
	EventLogger,
	createLogger,
	createEventLogger,
	createLoggerFromConfig,
	type LogLevel,
	type LogEventCallback,
} from "../logger";

class MockWriteStream {
	public data = "";

	write(chunk: string): void {
		this.data += chunk;
	}
}

describe("Logger System", () => {
	describe("WingmanLogger", () => {
		let mockStream: MockWriteStream;

		beforeEach(() => {
			mockStream = new MockWriteStream();
		});

		describe("Log level filtering", () => {
			it("should only log messages at or above configured level", () => {
				const logger = new WingmanLogger("warn", mockStream as any);

				logger.debug("debug message");
				logger.info("info message");
				logger.warn("warn message");
				logger.error("error message");

				expect(mockStream.data).not.toContain("debug message");
				expect(mockStream.data).not.toContain("info message");
				expect(mockStream.data).toContain("warn message");
				expect(mockStream.data).toContain("error message");
			});

			it("should log all messages when level is debug", () => {
				const logger = new WingmanLogger("debug", mockStream as any);

				logger.debug("debug message");
				logger.info("info message");
				logger.warn("warn message");
				logger.error("error message");

				expect(mockStream.data).toContain("debug message");
				expect(mockStream.data).toContain("info message");
				expect(mockStream.data).toContain("warn message");
				expect(mockStream.data).toContain("error message");
			});

			it("should not log any messages when level is silent", () => {
				const logger = new WingmanLogger("silent", mockStream as any);

				logger.debug("debug message");
				logger.info("info message");
				logger.warn("warn message");
				logger.error("error message");

				expect(mockStream.data).toBe("");
			});
		});

		describe("Log formatting", () => {
			it("should include timestamp and level in log output", () => {
				const logger = new WingmanLogger("info", mockStream as any);

				logger.info("test message");

				expect(mockStream.data).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
				expect(mockStream.data).toContain("[INFO]");
				expect(mockStream.data).toContain("test message");
			});

			it("should serialize additional arguments as JSON", () => {
				const logger = new WingmanLogger("info", mockStream as any);

				logger.info("test message", { key: "value" }, [1, 2, 3]);

				expect(mockStream.data).toContain("test message");
				expect(mockStream.data).toContain('"key"');
				expect(mockStream.data).toContain('"value"');
			});

			it("should serialize error arguments with message and stack", () => {
				const logger = new WingmanLogger("info", mockStream as any);
				const err = new Error("boom");

				logger.error("test error", err);

				expect(mockStream.data).toContain("test error");
				expect(mockStream.data).toContain('"message"');
				expect(mockStream.data).toContain("boom");
			});

			it("should not include args when none provided", () => {
				const logger = new WingmanLogger("info", mockStream as any);

				logger.info("test message");

				const lines = mockStream.data.split("\n");
				expect(lines.filter((l) => l.trim()).length).toBe(1);
			});
		});

		describe("Log levels", () => {
			it("should have debug method", () => {
				const logger = new WingmanLogger("debug", mockStream as any);
				expect(logger.debug).toBeDefined();
				expect(typeof logger.debug).toBe("function");
			});

			it("should have info method", () => {
				const logger = new WingmanLogger("info", mockStream as any);
				expect(logger.info).toBeDefined();
				expect(typeof logger.info).toBe("function");
			});

			it("should have warn method", () => {
				const logger = new WingmanLogger("warn", mockStream as any);
				expect(logger.warn).toBeDefined();
				expect(typeof logger.warn).toBe("function");
			});

			it("should have error method", () => {
				const logger = new WingmanLogger("error", mockStream as any);
				expect(logger.error).toBeDefined();
				expect(typeof logger.error).toBe("function");
			});
		});
	});

	describe("SilentLogger", () => {
		it("should not log any messages", () => {
			const logger = new SilentLogger();
			const consoleSpy = vi.spyOn(console, "log");

			logger.debug();
			logger.info();
			logger.warn();
			logger.error();

			expect(consoleSpy).not.toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it("should have all required logger methods", () => {
			const logger = new SilentLogger();

			expect(logger.debug).toBeDefined();
			expect(logger.info).toBeDefined();
			expect(logger.warn).toBeDefined();
			expect(logger.error).toBeDefined();
		});
	});

	describe("EventLogger", () => {
		let mockCallback: LogEventCallback;

		beforeEach(() => {
			mockCallback = vi.fn() as LogEventCallback;
		});

		describe("Event emission", () => {
			it("should emit log events with correct structure", () => {
				const logger = new EventLogger(mockCallback, "info");

				logger.info("test message");

				expect(mockCallback).toHaveBeenCalledTimes(1);
				expect(mockCallback).toHaveBeenCalledWith({
					level: "info",
					message: "test message",
					timestamp: expect.stringMatching(
						/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
					),
					args: undefined,
				});
			});

			it("should include args in events when provided", () => {
				const logger = new EventLogger(mockCallback, "info");
				const testArgs = [{ key: "value" }, [1, 2, 3]];

				logger.info("test message", ...testArgs);

				expect(mockCallback).toHaveBeenCalledWith({
					level: "info",
					message: "test message",
					timestamp: expect.any(String),
					args: testArgs,
				});
			});
		});

		describe("Level filtering", () => {
			it("should respect log level filtering", () => {
				const logger = new EventLogger(mockCallback, "warn");

				logger.debug("debug");
				logger.info("info");
				logger.warn("warn");
				logger.error("error");

				expect(mockCallback).toHaveBeenCalledTimes(2);
				expect(mockCallback).toHaveBeenCalledWith(
					expect.objectContaining({ level: "warn" })
				);
				expect(mockCallback).toHaveBeenCalledWith(
					expect.objectContaining({ level: "error" })
				);
			});

			it("should not emit events when level is silent", () => {
				const logger = new EventLogger(mockCallback, "silent");

				logger.debug("debug");
				logger.info("info");
				logger.warn("warn");
				logger.error("error");

				expect(mockCallback).not.toHaveBeenCalled();
			});
		});

		describe("All log levels", () => {
			it("should handle debug level", () => {
				const logger = new EventLogger(mockCallback, "debug");

				logger.debug("debug message");

				expect(mockCallback).toHaveBeenCalledWith(
					expect.objectContaining({
						level: "debug",
						message: "debug message",
					})
				);
			});

			it("should handle info level", () => {
				const logger = new EventLogger(mockCallback, "info");

				logger.info("info message");

				expect(mockCallback).toHaveBeenCalledWith(
					expect.objectContaining({
						level: "info",
						message: "info message",
					})
				);
			});

			it("should handle warn level", () => {
				const logger = new EventLogger(mockCallback, "info");

				logger.warn("warn message");

				expect(mockCallback).toHaveBeenCalledWith(
					expect.objectContaining({
						level: "warn",
						message: "warn message",
					})
				);
			});

			it("should handle error level", () => {
				const logger = new EventLogger(mockCallback, "info");

				logger.error("error message");

				expect(mockCallback).toHaveBeenCalledWith(
					expect.objectContaining({
						level: "error",
						message: "error message",
					})
				);
			});
		});
	});

	describe("Factory functions", () => {
		describe("createLogger", () => {
			const originalEnv = process.env.WINGMAN_LOG_LEVEL;

			afterEach(() => {
				process.env.WINGMAN_LOG_LEVEL = originalEnv;
			});

			it("should create WingmanLogger by default", () => {
				const logger = createLogger("info");

				expect(logger).toBeInstanceOf(WingmanLogger);
			});

			it("should create SilentLogger when level is silent", () => {
				const logger = createLogger("silent");

				expect(logger).toBeInstanceOf(SilentLogger);
			});

			it("should use WINGMAN_LOG_LEVEL env var when no level provided", () => {
				process.env.WINGMAN_LOG_LEVEL = "debug";

				const logger = createLogger();

				expect(logger).toBeInstanceOf(WingmanLogger);
			});

			it("should default to info level when env var not set", () => {
				delete process.env.WINGMAN_LOG_LEVEL;

				const logger = createLogger();

				expect(logger).toBeInstanceOf(WingmanLogger);
			});
		});

		describe("createEventLogger", () => {
			it("should create EventLogger with callback", () => {
				const callback = vi.fn();
				const logger = createEventLogger(callback, "info");

				expect(logger).toBeInstanceOf(EventLogger);
			});

			it("should create EventLogger with default info level", () => {
				const callback = vi.fn();
				const logger = createEventLogger(callback);

				logger.info("test");

				expect(callback).toHaveBeenCalledWith(
					expect.objectContaining({ level: "info" })
				);
			});
		});

		describe("createLoggerFromConfig", () => {
			it("should create logger from serializable config", () => {
				const logger = createLoggerFromConfig({ level: "debug" });

				expect(logger).toBeInstanceOf(WingmanLogger);
			});

			it("should create silent logger from silent config", () => {
				const logger = createLoggerFromConfig({ level: "silent" });

				expect(logger).toBeInstanceOf(SilentLogger);
			});
		});
	});

	describe("Log level hierarchy", () => {
		it("should respect level hierarchy: debug < info < warn < error", () => {
			const testCases: Array<{
				level: LogLevel;
				shouldLog: { debug: boolean; info: boolean; warn: boolean; error: boolean };
			}> = [
				{
					level: "debug",
					shouldLog: { debug: true, info: true, warn: true, error: true },
				},
				{
					level: "info",
					shouldLog: { debug: false, info: true, warn: true, error: true },
				},
				{
					level: "warn",
					shouldLog: { debug: false, info: false, warn: true, error: true },
				},
				{
					level: "error",
					shouldLog: { debug: false, info: false, warn: false, error: true },
				},
			];

			for (const testCase of testCases) {
				const callback = vi.fn();
				const logger = new EventLogger(callback, testCase.level);

				logger.debug("debug");
				logger.info("info");
				logger.warn("warn");
				logger.error("error");

				const debugCalls = callback.mock.calls.filter(
					([event]: any) => event.level === "debug"
				).length;
				const infoCalls = callback.mock.calls.filter(
					([event]: any) => event.level === "info"
				).length;
				const warnCalls = callback.mock.calls.filter(
					([event]: any) => event.level === "warn"
				).length;
				const errorCalls = callback.mock.calls.filter(
					([event]: any) => event.level === "error"
				).length;

				expect(debugCalls).toBe(testCase.shouldLog.debug ? 1 : 0);
				expect(infoCalls).toBe(testCase.shouldLog.info ? 1 : 0);
				expect(warnCalls).toBe(testCase.shouldLog.warn ? 1 : 0);
				expect(errorCalls).toBe(testCase.shouldLog.error ? 1 : 0);
			}
		});
	});
});
