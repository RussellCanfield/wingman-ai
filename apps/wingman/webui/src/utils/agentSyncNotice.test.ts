import { describe, expect, it } from "vitest";
import { agentSyncNotice } from "./agentSyncNotice";

describe("agentSyncNotice", () => {
	it("keeps docs-aligned bundled agent sync commands", () => {
		expect(agentSyncNotice.heading).toBe("Agent Sync");
		expect(agentSyncNotice.body).toContain(".wingman/agents/");
		expect(agentSyncNotice.commands).toEqual([
			"wingman init --mode sync --only agents",
			"wingman init --mode sync --only agents --agents main,coding",
			"wingman init --mode sync --only agents --force",
		]);
		expect(agentSyncNotice.note).toContain("only sync bundled agent templates");
	});
});
