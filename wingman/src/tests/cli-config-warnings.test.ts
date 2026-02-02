import { describe, it, expect } from "vitest";
import { validateConfig } from "../cli/config/schema";
import { collectConfigWarnings } from "../cli/config/warnings";

describe("Config warnings", () => {
	it("returns warnings for common Discord config issues", () => {
		const base = validateConfig({}).data!;
		const config = {
			...base,
			gateway: {
				...base.gateway,
				adapters: {
					...base.gateway.adapters,
					discord: {
						enabled: true,
						token: undefined,
						mentionOnly: true,
						allowBots: false,
						allowedGuilds: [" "],
						allowedChannels: ["", " 123 "],
						channelSessions: {
							" 123 ": " session-plain ",
							"456": "session-plain",
						},
						sessionCommand: " ",
						responseChunkSize: 1900,
					},
				},
			},
		};

		const warnings = collectConfigWarnings(config).map((warning) => warning.message);

		expect(warnings.some((msg) => msg.includes("token"))).toBe(true);
		expect(warnings.some((msg) => msg.includes("sessionCommand"))).toBe(true);
		expect(warnings.some((msg) => msg.includes("channelSessions"))).toBe(true);
		expect(warnings.some((msg) => msg.includes("agent prefix"))).toBe(true);
		expect(warnings.some((msg) => msg.includes("allowedChannels"))).toBe(true);
		expect(warnings.some((msg) => msg.includes("allowedGuilds"))).toBe(true);
	});

	it("returns no warnings when Discord adapter is disabled", () => {
		const base = validateConfig({}).data!;
		expect(collectConfigWarnings(base)).toEqual([]);
	});
});
