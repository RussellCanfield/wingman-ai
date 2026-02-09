import { describe, expect, it } from "vitest";
import {
	collectWorkspaceLoadingTasks,
	formatSlowLoadEvent,
} from "./loadingState";

describe("collectWorkspaceLoadingTasks", () => {
	it("returns task labels in stable order", () => {
		const tasks = collectWorkspaceLoadingTasks({
			checkingConnection: true,
			sessionsLoading: true,
			agentsLoading: false,
			providersLoading: true,
			voiceConfigLoading: true,
		});

		expect(tasks).toEqual(["connection", "sessions", "providers", "voice"]);
	});

	it("returns an empty list when nothing is loading", () => {
		const tasks = collectWorkspaceLoadingTasks({
			checkingConnection: false,
			sessionsLoading: false,
			agentsLoading: false,
			providersLoading: false,
			voiceConfigLoading: false,
		});

		expect(tasks).toEqual([]);
	});
});

describe("formatSlowLoadEvent", () => {
	it("returns null under threshold", () => {
		expect(formatSlowLoadEvent("sessions", 850, 1000)).toBeNull();
	});

	it("formats a message when duration exceeds threshold", () => {
		expect(formatSlowLoadEvent("sessions", 1540, 1000)).toBe(
			"Slow load: sessions (1540ms)",
		);
	});
});
