import { createDeepAgent } from "deepagents";
import { describe, expect, it } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import {
	configureDeepAgentSummarizationMiddleware,
	recompileDeepAgentWithMiddlewareOverrides,
} from "../../cli/core/agentInvoker.js";

const ciValue = (process.env.CI ?? "").toLowerCase();
const isCiEnvironment = ciValue !== "" && ciValue !== "0" && ciValue !== "false";
const RUN_SUMMARIZATION_E2E =
	process.env.WINGMAN_SUMMARIZATION_E2E === "1" && !isCiEnvironment;

const describeE2E = RUN_SUMMARIZATION_E2E ? describe : describe.skip;

const THREAD_ID = "summarization-e2e-thread";

class LocalEchoChatModel extends BaseChatModel {
	private tools: unknown[] = [];

	constructor() {
		super({});
	}

	bindTools(tools: unknown[]): LocalEchoChatModel {
		const next = new LocalEchoChatModel();
		next.tools = [...this.tools, ...tools];
		return next;
	}

	_llmType(): string {
		return "local-echo-chat-model";
	}

	_combineLLMOutput(): unknown[] {
		return [];
	}

	async _generate(messages: Array<{ content: unknown }>): Promise<{
		generations: Array<{
			text: string;
			message: AIMessage;
		}>;
		llmOutput: Record<string, unknown>;
	}> {
		const text = messages
			.map((message) => {
				const content = message.content;
				if (typeof content === "string") return content;
				return JSON.stringify(content);
			})
			.join("\n");
		const message = new AIMessage({ content: text });
		return {
			generations: [{ text, message }],
			llmOutput: {},
		};
	}
}

const extractStateMessages = (
	state: unknown,
): Array<Record<string, unknown>> => {
	if (!state || typeof state !== "object") return [];
	const record = state as Record<string, unknown>;
	const values =
		record.values && typeof record.values === "object"
			? (record.values as Record<string, unknown>)
			: null;
	const direct = values?.messages;
	if (Array.isArray(direct)) {
		return direct.filter(
			(entry): entry is Record<string, unknown> =>
				Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
		);
	}
	return [];
};

const isSummarizationMessage = (message: Record<string, unknown>): boolean => {
	const additionalKwargs =
		message.additional_kwargs &&
		typeof message.additional_kwargs === "object" &&
		!Array.isArray(message.additional_kwargs)
			? (message.additional_kwargs as Record<string, unknown>)
			: null;
	return additionalKwargs?.lc_source === "summarization";
};

describeE2E("Summarization E2E Integration (manual-only)", () => {
	it("summarizes thread history when low token threshold is exceeded", async () => {
		const model = new LocalEchoChatModel();
		let agent = createDeepAgent({
			model,
			tools: [],
			systemPrompt: "You are a test agent.",
			checkpointer: new MemorySaver(),
		}) as any;

		configureDeepAgentSummarizationMiddleware(
			agent,
			{ maxTokensBeforeSummary: 30, messagesToKeep: 1 },
			model,
		);
		agent = recompileDeepAgentWithMiddlewareOverrides(agent);

		const invocationConfig = {
			configurable: { thread_id: THREAD_ID },
		};

		await agent.invoke(
			{
				messages: [
					{
						role: "user",
						content:
							"Turn one: collect and retain these details for later synthesis.",
					},
				],
			},
			invocationConfig,
		);
		await agent.invoke(
			{
				messages: [
					{
						role: "user",
						content:
							"Turn two: include additional context and constraints for the prior request.",
					},
				],
			},
			invocationConfig,
		);
		await agent.invoke(
			{
				messages: [
					{
						role: "user",
						content:
							"Turn three: force context growth so the summarization middleware must compress history.",
					},
				],
			},
			invocationConfig,
		);

		const state = await agent.getState(invocationConfig);
		const stateMessages = extractStateMessages(state);
		const summaryMessages = stateMessages.filter(isSummarizationMessage);

		expect(summaryMessages.length).toBeGreaterThan(0);
		expect(stateMessages.length).toBeLessThan(6);
	});
});
