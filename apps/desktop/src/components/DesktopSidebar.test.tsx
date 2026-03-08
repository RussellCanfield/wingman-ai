import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DesktopSidebar } from "./DesktopSidebar";
import {
	DocsIcon,
	EventsIcon,
	RuntimeIcon,
	SettingsIcon,
} from "./DesktopIcons";

(globalThis as { React?: typeof React }).React = React;

const utilityItems = [
	{ type: "route" as const, path: "/settings", label: "Settings", icon: SettingsIcon },
	{ type: "route" as const, path: "/runtime", label: "Runtime", icon: RuntimeIcon },
	{
		type: "route" as const,
		path: "/events",
		label: "Events",
		icon: EventsIcon,
	},
	{
		type: "link" as const,
		href: "https://docs.getwingmanai.com",
		label: "Docs",
		icon: DocsIcon,
	},
];

function renderSidebar(initialPath = "/settings") {
	return renderToStaticMarkup(
		<MemoryRouter initialEntries={[initialPath]}>
			<DesktopSidebar
				agents={[
					{ id: "main", displayName: "Main Agent" },
					{ id: "reviewer", displayName: "Reviewer" },
				]}
				selectedAgentId="main"
				threads={[
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
				]}
				selectedThreadId="thread-2"
				sessionsLoading={false}
				utilityItems={utilityItems}
				onSelectAgent={() => {}}
				onSelectThread={() => {}}
				onCreateThread={() => {}}
				onRefreshThreads={() => {}}
				statusBadge={<div>Connected</div>}
			/>
		</MemoryRouter>,
	);
}

describe("DesktopSidebar", () => {
	it("renders the chat-first sidebar shell", () => {
		const html = renderSidebar();

		expect(html).toContain("Wingman");
		expect(html).toContain(">New<");
		expect(html).toContain("Conversations");
		expect(html).toContain("Alpha Thread");
		expect(html).toContain("Beta Thread");
		expect(html).toContain(
			'class="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"',
		);
		expect(html).toContain('href="/settings"');
		expect(html).toContain('href="/runtime"');
		expect(html).toContain('href="/events"');
		expect(html).toContain('href="https://docs.getwingmanai.com"');
		expect(html).toContain("Connected");
	});
});
