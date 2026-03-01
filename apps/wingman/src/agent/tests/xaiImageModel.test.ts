import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeXAIImageModel } from "../config/xaiImageModel";

const originalXaiApiKey = process.env.XAI_API_KEY;

describe("NativeXAIImageModel", () => {
	beforeEach(() => {
		process.env.XAI_API_KEY = "test-xai-api-key";
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		if (originalXaiApiKey === undefined) {
			delete process.env.XAI_API_KEY;
			return;
		}
		process.env.XAI_API_KEY = originalXaiApiKey;
	});

	it("maps xAI image URLs to output_image content blocks", async () => {
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					data: [{ url: "https://cdn.example.com/generated.png" }],
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		const model = new NativeXAIImageModel({
			model: "grok-imagine-image",
			apiKey: process.env.XAI_API_KEY,
		});

		const result = await model.invoke([
			new SystemMessage("Always prioritize cinematic composition."),
			new HumanMessage("A floating city at sunset"),
		]);

		const content = (result as { content?: unknown }).content;
		expect(Array.isArray(content)).toBe(true);
		expect(content).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "output_image",
					image_url: "https://cdn.example.com/generated.png",
				}),
			]),
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const firstCall = fetchMock.mock.calls[0];
		expect(firstCall).toBeDefined();
		const [endpoint, init] = firstCall as unknown as [string, RequestInit];
		const headers =
			init?.headers && typeof init.headers === "object"
				? (init.headers as Record<string, string>)
				: {};
		expect(endpoint).toBe("https://api.x.ai/v1/images/generations");
		expect(headers.Authorization).toBe("Bearer test-xai-api-key");
		const rawBody = typeof init.body === "string" ? init.body : "{}";
		const body = JSON.parse(rawBody) as Record<string, unknown>;
		expect(body.model).toBe("grok-imagine-image");
		expect(String(body.prompt || "")).toContain("A floating city at sunset");
	});

	it("maps b64_json responses to data URLs", async () => {
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					data: [{ b64_json: "abc123", mime_type: "image/jpeg" }],
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		const model = new NativeXAIImageModel({
			model: "grok-imagine-image",
			apiKey: process.env.XAI_API_KEY,
		});

		const result = await model.invoke("Retro arcade poster");
		const content = (result as { content?: unknown }).content as Array<
			Record<string, unknown>
		>;
		const imageBlock = content.find((entry) => entry.type === "output_image");
		expect(imageBlock).toBeDefined();
		expect(String(imageBlock?.image_url || "")).toBe(
			"data:image/jpeg;base64,abc123",
		);
	});

	it("surfaces xAI API error messages", async () => {
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					error: { message: "Model does not support this endpoint" },
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		const model = new NativeXAIImageModel({
			model: "grok-imagine-image",
			apiKey: process.env.XAI_API_KEY,
		});

		await expect(model.invoke("Generate a hero banner")).rejects.toThrow(
			/Model does not support this endpoint/i,
		);
	});

	it("fails fast when xAI credentials are missing", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const model = new NativeXAIImageModel({
			model: "grok-imagine-image",
		});

		await expect(model.invoke("Generate a logo")).rejects.toThrow(
			/Missing xAI credentials/i,
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("supports no-op bindTools for LangGraph compatibility", () => {
		const model = new NativeXAIImageModel({
			model: "grok-imagine-image",
			apiKey: process.env.XAI_API_KEY,
		});

		const bound = model.bindTools([]);
		expect(bound).toBe(model);
	});

	it("ignores hidden middleware user prompts when building xAI image input", async () => {
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					data: [{ url: "https://cdn.example.com/generated.png" }],
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		const model = new NativeXAIImageModel({
			model: "grok-imagine-image",
			apiKey: process.env.XAI_API_KEY,
		});

		await model.invoke([
			new HumanMessage("hi"),
			new HumanMessage({
				content:
					"# Confidentiality (Internal)\n** Current Date Time (UTC): 2026-03-01T20:57:29.433Z **\n** Dynamic UI Registry **",
				additional_kwargs: {
					ui_hidden: true,
					source: "additional-message-middleware",
				},
			}),
		]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const firstCall = fetchMock.mock.calls[0];
		expect(firstCall).toBeDefined();
		const [, init] = firstCall as unknown as [string, RequestInit];
		const rawBody = typeof init.body === "string" ? init.body : "{}";
		const body = JSON.parse(rawBody) as Record<string, unknown>;
		const prompt = String(body.prompt || "");
		expect(prompt).toContain("hi");
		expect(prompt.toLowerCase()).not.toContain("# confidentiality (internal)");
		expect(prompt.toLowerCase()).not.toContain("dynamic ui registry");
	});

	it("clamps oversized prompts to xAI-compatible length", async () => {
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					data: [{ url: "https://cdn.example.com/generated.png" }],
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		const model = new NativeXAIImageModel({
			model: "grok-imagine-image",
			apiKey: process.env.XAI_API_KEY,
		});

		await model.invoke([
			new SystemMessage("S".repeat(20_000)),
			new HumanMessage("hi"),
		]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const firstCall = fetchMock.mock.calls[0];
		expect(firstCall).toBeDefined();
		const [, init] = firstCall as unknown as [string, RequestInit];
		const rawBody = typeof init.body === "string" ? init.body : "{}";
		const body = JSON.parse(rawBody) as Record<string, unknown>;
		const prompt = String(body.prompt || "");
		expect(prompt.length).toBeLessThanOrEqual(7900);
		expect(prompt).toContain("User request:\nhi");
	});
});
