import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesktopBrandBadge } from "./components/DesktopBrandBadge";

(globalThis as { React?: typeof React }).React = React;

describe("DesktopBrandBadge", () => {
	it("renders the Wingman mark next to the label", () => {
		const html = renderToStaticMarkup(React.createElement(DesktopBrandBadge));

		expect(html).toContain("Wingman");
		expect(html).toContain('viewBox="0 0 40 40"');
		expect(html).toContain(
			"inline-flex items-center gap-2 rounded-full border border-white/25",
		);
	});
});
