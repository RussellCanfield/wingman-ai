import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WebhooksPage } from "./WebhooksPage";

(globalThis as { React?: typeof React }).React = React;

const baseProps: React.ComponentProps<typeof WebhooksPage> = {
	agents: [{ id: "main", name: "Main Agent" }],
	webhooks: [],
	threads: [],
	loading: false,
	baseUrl: "https://wingman.test",
	onCreateWebhook: async () => true,
	onUpdateWebhook: async () => true,
	onDeleteWebhook: async () => true,
	onTestWebhook: async () => ({ ok: true }),
	onRefresh: () => {},
};

describe("WebhooksPage", () => {
	it("stacks the editor and configured webhooks panels vertically", () => {
		const html = renderToStaticMarkup(<WebhooksPage {...baseProps} />);

		expect(html).toContain('<section class="space-y-6">');
		expect(html).toContain("Create Webhook");
		expect(html).toContain("Configured Webhooks");
		expect(html).not.toContain(
			"xl:grid-cols-[minmax(420px,1fr)_minmax(360px,1fr)]",
		);
	});
});
