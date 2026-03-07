import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkdirModal } from "./WorkdirModal";

(globalThis as { React?: typeof React }).React = React;

describe("WorkdirModal", () => {
	it("renders the lean current-folder summary", () => {
		const html = renderToStaticMarkup(
			React.createElement(WorkdirModal, {
				open: true,
				defaultWorkdir: "/tmp/wingman-output/main",
				onClose: () => {},
				onSave: async () => true,
			}),
		);

		expect(html).toContain("Current Folder");
		expect(html).toContain("Default Folder");
		expect(html).toContain("Revert to Default");
		expect(html).toContain("Use Selected Folder");
		expect(html).toContain("Create Folder");
		expect(html).toContain("New folder name");
	});
});
