import { describe, expect, it } from "vitest";
import { createBackgroundTerminalTool } from "../tools/background_terminal";
import { TerminalSessionManager } from "../tools/terminal_session_manager";

describe("background terminal tools", () => {
	it("rejects blocked commands", async () => {
		const manager = new TerminalSessionManager();
		try {
			const tool = createBackgroundTerminalTool({
				workspace: process.cwd(),
				ownerId: "test-owner",
				sessionManager: manager,
				blockedCommands: ["rm"],
			});
			const result = (await tool.invoke({
				command: "rm -rf ./tmp",
			})) as Record<string, unknown>;
			expect(result.error).toContain("rejected");
		} finally {
			manager.dispose();
		}
	});

	it("supports start and write/poll flow", async () => {
		const manager = new TerminalSessionManager();
		try {
			const tool = createBackgroundTerminalTool({
				workspace: process.cwd(),
				ownerId: "owner-flow",
				sessionManager: manager,
			});

			const started = (await tool.invoke({
				command: "cat",
				wait_ms: 10,
			})) as Record<string, unknown>;
			expect(typeof started.session_id).toBe("string");
			const sessionId = String(started.session_id);

			const writeResult = (await tool.invoke({
				session_id: sessionId,
				chars: "hello\n",
				wait_ms: 1000,
			})) as Record<string, unknown>;
			expect(String(writeResult.output || "")).toContain("hello");
		} finally {
			manager.dispose();
		}
	});
});
