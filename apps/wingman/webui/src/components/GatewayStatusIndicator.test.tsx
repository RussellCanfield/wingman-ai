import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GatewayStatusIndicator } from "./GatewayStatusIndicator";

(globalThis as { React?: typeof React }).React = React;

describe("GatewayStatusIndicator", () => {
	it("renders a fixed top-centered online control", () => {
		const html = renderToStaticMarkup(
			React.createElement(GatewayStatusIndicator, {
				connected: true,
				connecting: false,
			}),
		);

		expect(html).toContain("fixed inset-x-0 top-0 z-40 flex justify-center");
		expect(html).toContain('aria-label="Gateway Online"');
		expect(html).toContain(">Gateway<");
		expect(html).toContain(">Online<");
		expect(html).toContain("rounded-b-[18px]");
		expect(html).not.toContain("127.0.0.1:18789");
	});
});
