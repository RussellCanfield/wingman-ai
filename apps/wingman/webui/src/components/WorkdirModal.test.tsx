import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkdirModal } from "./WorkdirModal";

(globalThis as { React?: typeof React }).React = React;

describe("WorkdirModal", () => {
	it("renders create-folder controls", () => {
		const html = renderToStaticMarkup(
			React.createElement(WorkdirModal, {
				open: true,
				outputRoot: "/tmp/wingman-output",
				onClose: () => {},
				onSave: async () => true,
			}),
		);

		expect(html).toContain("Create Folder");
		expect(html).toContain("New folder name");
	});
});
