import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./Sidebar";

(globalThis as { React?: typeof React }).React = React;

const baseProps: React.ComponentProps<typeof Sidebar> = {
	variant: "default",
	activeAgents: [
		{ id: "main", name: "Main Agent" },
		{ id: "reviewer", name: "Reviewer" },
	],
	selectedAgentId: "main",
	threads: [
		{
			id: "thread-1",
			name: "Alpha Thread",
			agentId: "main",
			messageCount: 4,
			messages: [],
			createdAt: 1,
		},
		{
			id: "thread-2",
			name: "Beta Thread",
			agentId: "reviewer",
			messageCount: 2,
			messages: [],
			createdAt: 2,
		},
	],
	activeThreadId: "thread-2",
	loadingThreads: false,
	onSelectAgent: () => {},
	onSelectThread: () => {},
	onCreateThread: async () => null,
	onDeleteThread: () => {},
	onRenameThread: () => {},
	getAgentLabel: (agentId) => (agentId === "main" ? "Main Agent" : "Reviewer"),
};

function renderSidebar(initialPath = "/") {
	return renderToStaticMarkup(
		<StaticRouter location={initialPath}>
			<Sidebar {...baseProps} />
		</StaticRouter>,
	);
}

describe("Sidebar", () => {
	it("renders a conversation rail with a settings footer", () => {
		const html = renderSidebar("/");

		expect(html).toContain("Wingman");
		expect(html).toContain("New conversation");
		expect(html).toContain(">New<");
		expect(html).toContain("Alpha Thread");
		expect(html).toContain("Beta Thread");
		expect(html).toContain(
			'class="min-h-0 flex flex-1 flex-col gap-3 overflow-hidden"',
		);
		expect(html).toContain(
			'class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"',
		);
		expect(html).toContain('href="/settings"');
		expect(html).toContain('href="/webhooks"');
		expect(html).toContain('href="/routines"');
		expect(html).toContain('href="https://docs.getwingmanai.com"');
		expect(html).not.toContain('href="/chat"');
		expect(html).not.toContain('href="/agents"');
		expect(html).not.toContain("Command Deck");
	});

	it("keeps conversations visible when a utility route is active", () => {
		const html = renderSidebar("/settings");

		expect(html).toContain("Conversations");
		expect(html).toContain("Alpha Thread");
		expect(html).toContain("Beta Thread");
		expect(html).toContain("Settings");
	});
});
