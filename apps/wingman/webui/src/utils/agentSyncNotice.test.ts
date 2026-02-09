import { describe, expect, it } from "vitest";
import { agentSyncNotice } from "./agentSyncNotice";

describe("agentSyncNotice", () => {
	it("keeps docs-aligned bundled agent sync commands", () => {
		expect(agentSyncNotice.heading).toBe("Agent Sync");
		expect(agentSyncNotice.body).toContain(".wingman/agents/");
		expect(agentSyncNotice.commands).toEqual([
			"wingman init --skip-config --skip-provider",
			"wingman init --skip-config --skip-provider --agents main,coding",
			"wingman init --skip-config --skip-provider --force",
		]);
		expect(agentSyncNotice.note).toContain("only sync bundled agent templates");
	});
});
