import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UpdateAvailableBanner } from "./UpdateAvailableBanner";

(globalThis as { React?: typeof React }).React = React;

describe("UpdateAvailableBanner", () => {
	it("renders update details and upgrade command", () => {
		const html = renderToStaticMarkup(
			React.createElement(UpdateAvailableBanner, {
				notice: {
					packageName: "@wingman-ai/gateway",
					currentVersion: "0.6.0",
					latestVersion: "0.6.2",
					command: "npm install -g @wingman-ai/gateway@latest",
				},
				offsetClass: "top-12",
			}),
		);

		expect(html).toContain('aria-label="Wingman update available"');
		expect(html).toContain("Update Available");
		expect(html).toContain("Wingman 0.6.0 to 0.6.2");
		expect(html).toContain("npm install -g @wingman-ai/gateway@latest");
		expect(html).toContain("top-12");
	});
});
