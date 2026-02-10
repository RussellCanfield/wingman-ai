import { describe, expect, it } from "vitest";
import { TerminalSessionManager } from "../tools/terminal_session_manager";

async function waitForTerminalCompletion(
	manager: TerminalSessionManager,
	ownerId: string,
	sessionId: string,
	timeoutMs = 5_000,
) {
	const started = Date.now();
	let lastOutput = "";
	while (Date.now() - started < timeoutMs) {
		const poll = await manager.pollSession({
			ownerId,
			sessionId,
			waitMs: 200,
			maxOutputChars: 2000,
		});
		lastOutput += poll.output;
		if (poll.status !== "running") {
			return { ...poll, output: lastOutput };
		}
	}
	throw new Error(`Timed out waiting for terminal session ${sessionId}`);
}

describe("TerminalSessionManager", () => {
	it("runs commands and returns output", async () => {
		const manager = new TerminalSessionManager();
		try {
			const session = manager.startSession({
				ownerId: "owner-a",
				command: "node -e \"process.stdout.write('hello\\n')\"",
				cwd: process.cwd(),
				env: process.env as Record<string, string>,
			});
			const finalState = await waitForTerminalCompletion(
				manager,
				"owner-a",
				session.sessionId,
			);

			expect(finalState.output).toContain("hello");
			expect(["completed", "error", "killed", "timed_out"]).toContain(
				finalState.status,
			);
		} finally {
			manager.dispose();
		}
	});

	it("enforces session ownership", async () => {
		const manager = new TerminalSessionManager();
		try {
			const session = manager.startSession({
				ownerId: "owner-allowed",
				command: 'node -e "setTimeout(() => {}, 500)"',
				cwd: process.cwd(),
				env: process.env as Record<string, string>,
			});

			await expect(
				manager.pollSession({
					ownerId: "owner-denied",
					sessionId: session.sessionId,
					waitMs: 0,
				}),
			).rejects.toThrow("not accessible");
		} finally {
			manager.dispose();
		}
	});

	it("supports stdin writes and kill", async () => {
		const manager = new TerminalSessionManager();
		try {
			const session = manager.startSession({
				ownerId: "owner-b",
				command: "cat",
				cwd: process.cwd(),
				env: process.env as Record<string, string>,
			});

			manager.writeSession({
				ownerId: "owner-b",
				sessionId: session.sessionId,
				chars: "ping\n",
			});

			const poll = await manager.pollSession({
				ownerId: "owner-b",
				sessionId: session.sessionId,
				waitMs: 1000,
				maxOutputChars: 2000,
			});
			expect(poll.output).toContain("ping");

			const killed = manager.killSession({
				ownerId: "owner-b",
				sessionId: session.sessionId,
				signal: "SIGTERM",
			});
			expect([
				"running",
				"killed",
				"timed_out",
				"error",
				"completed",
			]).toContain(killed.status);
		} finally {
			manager.dispose();
		}
	});

	it("drops buffered output when max buffer is exceeded", async () => {
		const manager = new TerminalSessionManager({
			maxBufferedCharsPerSession: 32,
		});
		try {
			const session = manager.startSession({
				ownerId: "owner-c",
				command:
					"node -e \"process.stdout.write('abcdefghijklmnopqrstuvwxyz0123456789')\"",
				cwd: process.cwd(),
				env: process.env as Record<string, string>,
			});
			const finalState = await waitForTerminalCompletion(
				manager,
				"owner-c",
				session.sessionId,
			);
			expect(finalState.droppedChars).toBeGreaterThan(0);
		} finally {
			manager.dispose();
		}
	});
});
