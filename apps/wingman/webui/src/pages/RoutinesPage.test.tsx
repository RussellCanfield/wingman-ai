import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoutinesPage } from "./RoutinesPage";

(globalThis as { React?: typeof React }).React = React;

const baseProps: React.ComponentProps<typeof RoutinesPage> = {
	agents: [{ id: "main", name: "Main Agent" }],
	routines: [],
	threads: [],
	loading: false,
	onCreateRoutine: async () => true,
	onDeleteRoutine: async () => true,
};

describe("RoutinesPage", () => {
	it("stacks the form and scheduled runs panels vertically", () => {
		const html = renderToStaticMarkup(<RoutinesPage {...baseProps} />);

		expect(html).toContain('<section class="space-y-6">');
		expect(html).toContain("Create Routine");
		expect(html).toContain("Scheduled Runs");
		expect(html).not.toContain("lg:grid-cols-[360px_1fr]");
	});
});
