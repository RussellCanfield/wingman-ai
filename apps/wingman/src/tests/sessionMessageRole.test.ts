import { describe, expect, it } from "vitest";
import { resolveMessageRole } from "../cli/core/sessionManager.js";

describe("resolveMessageRole", () => {
	it("resolves role from langchain id arrays", () => {
		const human = {
			type: "constructor",
			id: ["langchain_core", "messages", "HumanMessage"],
			kwargs: { content: "hi" },
		};
		const ai = {
			type: "constructor",
			id: ["langchain_core", "messages", "AIMessageChunk"],
			kwargs: { content: "hello" },
		};

		expect(resolveMessageRole(human)).toBe("user");
		expect(resolveMessageRole(ai)).toBe("assistant");
	});

	it("resolves role from explicit types", () => {
		expect(resolveMessageRole({ type: "human" })).toBe("user");
		expect(resolveMessageRole({ type: "ai" })).toBe("assistant");
	});
});
