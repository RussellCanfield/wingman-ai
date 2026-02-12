import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { HeroPanel, getInitialHeroPanelExpanded } from "./HeroPanel";

(globalThis as { React?: typeof React }).React = React;

const originalWindow = (globalThis as { window?: unknown }).window;
const originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;

const baseProps: React.ComponentProps<typeof HeroPanel> = {
	agentId: "main",
	activeThreadName: "thread-1",
	statusLabel: "online",
	connected: true,
	health: {
		status: "healthy",
		stats: { uptime: 120_000 },
	},
	stats: {
		nodes: { totalNodes: 2 },
		groups: { totalGroups: 1 },
	},
	formatDuration: () => "2m",
};

afterEach(() => {
	if (typeof originalWindow === "undefined") {
		delete (globalThis as { window?: unknown }).window;
	} else {
		(globalThis as { window?: unknown }).window = originalWindow;
	}

	if (typeof originalLocalStorage === "undefined") {
		delete (globalThis as { localStorage?: unknown }).localStorage;
	} else {
		(globalThis as { localStorage?: unknown }).localStorage = originalLocalStorage;
	}
});

describe("HeroPanel", () => {
	it("defaults to collapsed when no stored value exists", () => {
		expect(getInitialHeroPanelExpanded(null)).toBe(false);
	});

	it("uses stored expanded state when available", () => {
		expect(getInitialHeroPanelExpanded("true")).toBe(true);
		expect(getInitialHeroPanelExpanded("false")).toBe(false);
	});

	it("renders collapsed controls when not expanded", () => {
		(globalThis as { window?: unknown }).window = {};
		(globalThis as { localStorage?: Storage }).localStorage = {
			getItem: () => null,
			setItem: () => {},
			removeItem: () => {},
			clear: () => {},
			key: () => null,
			length: 0,
		};

		const html = renderToStaticMarkup(React.createElement(HeroPanel, baseProps));

		expect(html).toContain('aria-label="Expand mission console"');
		expect(html).toContain('class="hidden"');
	});

	it("renders expanded controls when stored state is true", () => {
		(globalThis as { window?: unknown }).window = {};
		(globalThis as { localStorage?: Storage }).localStorage = {
			getItem: () => "true",
			setItem: () => {},
			removeItem: () => {},
			clear: () => {},
			key: () => null,
			length: 0,
		};

		const html = renderToStaticMarkup(React.createElement(HeroPanel, baseProps));

		expect(html).toContain('aria-label="Collapse mission console"');
		expect(html).not.toContain('aria-label="Expand mission console"');
	});
});
