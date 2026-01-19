import { describe, it, expect } from "vitest";
import { ModelFactory } from "../config/modelFactory";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";

describe("ModelFactory", () => {
	describe("createModel", () => {
		it("should create an Anthropic model", () => {
			const model = ModelFactory.createModel("anthropic:claude-opus-4-5");

			expect(model).toBeInstanceOf(ChatAnthropic);
		});

		it("should create an OpenAI model", () => {
			const model = ModelFactory.createModel("openai:gpt-4o");

			expect(model).toBeInstanceOf(ChatOpenAI);
		});

		it("should throw error for invalid format (missing colon)", () => {
			expect(() => {
				ModelFactory.createModel("anthropic-claude-opus");
			}).toThrow(/Invalid model format/);
		});

		it("should throw error for invalid format (empty provider)", () => {
			expect(() => {
				ModelFactory.createModel(":claude-opus-4-5");
			}).toThrow(/Invalid model format/);
		});

		it("should throw error for invalid format (empty model)", () => {
			expect(() => {
				ModelFactory.createModel("anthropic:");
			}).toThrow(/Invalid model format/);
		});

		it("should throw error for unsupported provider", () => {
			expect(() => {
				ModelFactory.createModel("unsupported:model-name");
			}).toThrow(/Unknown model provider/);
		});

		it("should be case insensitive for provider names", () => {
			const model1 = ModelFactory.createModel("Anthropic:claude-opus-4-5");
			const model2 = ModelFactory.createModel("ANTHROPIC:claude-opus-4-5");

			expect(model1).toBeInstanceOf(ChatAnthropic);
			expect(model2).toBeInstanceOf(ChatAnthropic);
		});
	});

	describe("validateModelString", () => {
		it("should validate correct model strings", () => {
			const validModels = [
				"anthropic:claude-opus-4-5",
				"openai:gpt-4o",
				"anthropic:claude-sonnet-4-5-20250929",
			];

			for (const modelString of validModels) {
				const result = ModelFactory.validateModelString(modelString);
				expect(result.valid).toBe(true);
				expect(result.error).toBeUndefined();
			}
		});

		it("should reject invalid format", () => {
			const result = ModelFactory.validateModelString("invalid-format");

			expect(result.valid).toBe(false);
			expect(result.error).toContain("Invalid format");
		});

		it("should reject empty provider", () => {
			const result = ModelFactory.validateModelString(":model-name");

			expect(result.valid).toBe(false);
			expect(result.error).toContain("required");
		});

		it("should reject empty model", () => {
			const result = ModelFactory.validateModelString("anthropic:");

			expect(result.valid).toBe(false);
			expect(result.error).toContain("required");
		});

		it("should reject unsupported provider", () => {
			const result = ModelFactory.validateModelString("unsupported:model");

			expect(result.valid).toBe(false);
			expect(result.error).toContain("Unknown provider");
		});

		it("should accept case variations of providers", () => {
			const result1 = ModelFactory.validateModelString("Anthropic:model");
			const result2 = ModelFactory.validateModelString("OPENAI:model");

			expect(result1.valid).toBe(true);
			expect(result2.valid).toBe(true);
		});
	});
});
