import { describe, expect, it } from "vitest";
import {
	BROWSER_SESSION_TOOL_ALIAS,
	BROWSER_SESSION_TOOL_MEMBERS,
	buildAgentToolOptions,
	collapseAgentToolsForDisplay,
	expandAgentToolsForSave,
	getAgentToolHoverText,
} from "./agentTools";

describe("agentTools", () => {
	it("collapses the full browser session tool set into one alias", () => {
		expect(
			collapseAgentToolsForDisplay([
				"think",
				...BROWSER_SESSION_TOOL_MEMBERS,
				"browser_control",
			]),
		).toEqual(["think", BROWSER_SESSION_TOOL_ALIAS, "browser_control"]);
	});

	it("keeps partial browser session tool selections visible", () => {
		expect(
			collapseAgentToolsForDisplay([
				"think",
				"browser_session_start",
				"browser_session_action",
			]),
		).toEqual(["think", "browser_session_start", "browser_session_action"]);
	});

	it("expands the browser session alias back to concrete tools on save", () => {
		expect(
			expandAgentToolsForSave([
				"think",
				BROWSER_SESSION_TOOL_ALIAS,
				"browser_control",
			]),
		).toEqual(["think", ...BROWSER_SESSION_TOOL_MEMBERS, "browser_control"]);
	});

	it("shows selected legacy raw tools even when the picker collapses the group", () => {
		expect(
			buildAgentToolOptions(
				["think", ...BROWSER_SESSION_TOOL_MEMBERS],
				["browser_session_action"],
			),
		).toEqual(["think", BROWSER_SESSION_TOOL_ALIAS, "browser_session_action"]);
	});

	it("provides hover copy for the two browser tool modes", () => {
		expect(getAgentToolHoverText("browser_control")).toContain("single call");
		expect(getAgentToolHoverText(BROWSER_SESSION_TOOL_ALIAS)).toContain(
			"multiple tool calls",
		);
		expect(getAgentToolHoverText("think")).toBeUndefined();
	});
});
