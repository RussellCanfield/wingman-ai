import { AgentLoader } from "@/agent/config/agentLoader.js";
import { getAvailableTools } from "@/agent/config/toolRegistry.js";
import { GatewayRouter } from "../router.js";
import type { GatewayHttpContext } from "./types.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { AgentVoiceConfigSchema } from "@/types/voice.js";

type PromptTrainingConfig = Record<string, any> | boolean;

type SubAgentApiPayload = {
	id?: string;
	name?: string;
	displayName?: string;
	description?: string;
	tools?: string[];
	model?: string;
	prompt?: string;
	systemPrompt?: string;
	promptTraining?: PromptTrainingConfig | null;
	promptRefinement?: PromptTrainingConfig | null;
};

type NormalizedSubAgent = {
	name: string;
	description: string;
	tools: string[];
	model?: string;
	systemPrompt: string;
	promptRefinement?: PromptTrainingConfig;
};

const hasOwn = (value: unknown, key: string): boolean =>
	Boolean(value && Object.prototype.hasOwnProperty.call(value, key));

const getPromptTrainingFromPayload = (
	payload: Record<string, any>,
): PromptTrainingConfig | null | undefined => {
	if (hasOwn(payload, "promptTraining")) {
		return payload.promptTraining as PromptTrainingConfig | null | undefined;
	}
	if (hasOwn(payload, "promptRefinement")) {
		return payload.promptRefinement as PromptTrainingConfig | null | undefined;
	}
	return undefined;
};

const mapPromptTrainingFields = (value: PromptTrainingConfig | undefined) => ({
	promptTraining: value,
	promptRefinement: value,
});

const mapSubAgentForResponse = (sub: {
	name: string;
	description?: string;
	tools?: string[];
	model?: string;
	systemPrompt?: string;
	promptRefinement?: PromptTrainingConfig;
}) => ({
	id: sub.name,
	displayName: sub.name,
	description: sub.description,
	tools: sub.tools || [],
	model: sub.model,
	prompt: sub.systemPrompt,
	...mapPromptTrainingFields(sub.promptRefinement),
});

const normalizeSubAgents = (
	rawSubAgents: unknown,
): { ok: true; value: NormalizedSubAgent[] } | { ok: false; error: string } => {
	if (rawSubAgents === null || rawSubAgents === undefined) {
		return { ok: true, value: [] };
	}
	if (!Array.isArray(rawSubAgents)) {
		return { ok: false, error: "Invalid subAgents: expected an array" };
	}

	const availableTools = getAvailableTools();
	const normalized: NormalizedSubAgent[] = [];

	for (let index = 0; index < rawSubAgents.length; index += 1) {
		const item = rawSubAgents[index] as SubAgentApiPayload;
		if (!item || typeof item !== "object") {
			return {
				ok: false,
				error: `Invalid subAgents[${index}]: expected an object`,
			};
		}

		const name = (item.id || item.name || "").trim();
		if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
			return {
				ok: false,
				error: `Invalid subAgents[${index}].id`,
			};
		}

		const prompt = (item.prompt ?? item.systemPrompt ?? "").trim();
		if (!prompt) {
			return {
				ok: false,
				error: `Invalid subAgents[${index}].prompt`,
			};
		}
		const description = (item.description || "").trim();
		if (!description) {
			return {
				ok: false,
				error: `Invalid subAgents[${index}].description`,
			};
		}

		const promptTraining = getPromptTrainingFromPayload(
			item as Record<string, any>,
		);
		if (
			promptTraining !== undefined &&
			promptTraining !== null &&
			typeof promptTraining !== "boolean" &&
			(typeof promptTraining !== "object" || Array.isArray(promptTraining))
		) {
			return {
				ok: false,
				error: `Invalid subAgents[${index}].promptTraining`,
			};
		}

		const tools = Array.isArray(item.tools)
			? item.tools.filter((tool) => availableTools.includes(tool as any))
			: [];

		const sub: NormalizedSubAgent = {
			name,
			description,
			tools,
			model: item.model?.trim() || undefined,
			systemPrompt: prompt,
		};
		if (promptTraining !== undefined && promptTraining !== null) {
			sub.promptRefinement = promptTraining;
		}
		normalized.push(sub);
	}

	return { ok: true, value: normalized };
};

const buildAgentMarkdown = (params: {
	id: string;
	description?: string;
	tools: string[];
	model?: string;
	prompt?: string;
	voice?: Record<string, any>;
	promptRefinement?: PromptTrainingConfig;
	subAgents?: NormalizedSubAgent[];
}): string => {
	const {
		id,
		description,
		tools,
		model,
		prompt,
		voice,
		promptRefinement,
		subAgents,
	} = params;
	const metadata: Record<string, any> = {
		name: id,
		description: description || "New Wingman agent",
		tools: tools || [],
	};
	if (model) {
		metadata.model = model;
	}
	if (voice) {
		metadata.voice = voice;
	}
	if (promptRefinement !== undefined) {
		metadata.promptRefinement = promptRefinement;
	}
	if (subAgents && subAgents.length > 0) {
		metadata.subAgents = subAgents;
	}
	return serializeAgentMarkdown(metadata, prompt || "You are a Wingman agent.");
};

const parseAgentMarkdown = (content: string): {
	metadata: Record<string, any>;
	prompt: string;
} => {
	const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
	const match = content.match(frontmatterRegex);
	if (!match) {
		throw new Error("Invalid agent.md format: missing frontmatter");
	}
	const [, rawFrontmatter, prompt] = match;
	const metadata = (yaml.load(rawFrontmatter) as Record<string, any>) || {};
	return { metadata, prompt: prompt?.trim() || "" };
};

const serializeAgentMarkdown = (
	metadata: Record<string, any>,
	prompt: string,
): string => {
	const frontmatter = yaml.dump(metadata, { lineWidth: 120 });
	const safePrompt = prompt?.trim() || "You are a Wingman agent.";
	return `---\n${frontmatter}---\n\n${safePrompt}\n`;
};

export const handleAgentsApi = async (
	ctx: GatewayHttpContext,
	req: Request,
	url: URL,
): Promise<Response | null> => {
	const config = ctx.getWingmanConfig();

	if (url.pathname === "/api/agents") {
		if (req.method === "GET") {
			const loader = new AgentLoader(ctx.configDir, ctx.workspace, config);
			const configs = loader.loadAllAgentConfigs();
			const displayNames =
				config.agents?.list?.reduce<Record<string, string>>((acc, agent) => {
					if (agent.name) {
						acc[agent.id] = agent.name;
					}
					return acc;
				}, {}) || {};

			const agents = configs.map((agent) => ({
				id: agent.name,
				displayName: displayNames[agent.name] || agent.name,
				description: agent.description,
				tools: agent.tools || [],
				model: agent.model,
				voice: agent.voice,
				...mapPromptTrainingFields(agent.promptRefinement),
				subAgents:
					agent.subAgents?.map((sub) => mapSubAgentForResponse(sub)) || [],
			}));

			return new Response(
				JSON.stringify(
					{
						agents,
						tools: getAvailableTools(),
						builtInTools: ctx.getBuiltInTools(),
					},
					null,
					2,
				),
				{ headers: { "Content-Type": "application/json" } },
			);
		}

		if (req.method === "POST") {
			const body = (await req.json()) as {
				id?: string;
				displayName?: string;
				description?: string;
				model?: string;
				tools?: string[];
				prompt?: string;
				voice?: Record<string, any>;
				promptTraining?: PromptTrainingConfig | null;
				promptRefinement?: PromptTrainingConfig | null;
				subAgents?: SubAgentApiPayload[] | null;
				subagents?: SubAgentApiPayload[] | null;
			};
			let parsedVoice: Record<string, any> | undefined;
			if (body?.voice !== undefined && body.voice !== null) {
				const voiceResult = AgentVoiceConfigSchema.safeParse(body.voice);
				if (!voiceResult.success) {
					return new Response("Invalid voice configuration", { status: 400 });
				}
				parsedVoice = voiceResult.data;
			}

			const id = body?.id?.trim();
			if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
				return new Response("Invalid agent id", { status: 400 });
			}

			const tools = Array.isArray(body.tools)
				? body.tools.filter((tool) =>
						getAvailableTools().includes(tool as any),
					)
				: [];
			const promptTraining = getPromptTrainingFromPayload(
				body as Record<string, any>,
			);
			if (
				promptTraining !== undefined &&
				promptTraining !== null &&
				typeof promptTraining !== "boolean" &&
				(typeof promptTraining !== "object" || Array.isArray(promptTraining))
			) {
				return new Response("Invalid promptTraining configuration", {
					status: 400,
				});
			}

			const rawSubAgents = hasOwn(body, "subAgents")
				? body.subAgents
				: body.subagents;
			const subAgentsResult = normalizeSubAgents(rawSubAgents);
			if (!subAgentsResult.ok) {
				return new Response(subAgentsResult.error, { status: 400 });
			}

			const agentsDir = join(ctx.resolveConfigDirPath(), "agents", id);
			if (existsSync(agentsDir)) {
				return new Response("Agent already exists", { status: 409 });
			}

			mkdirSync(agentsDir, { recursive: true });
			const agentMarkdown = buildAgentMarkdown({
				id,
				description: body.description,
				tools,
				model: body.model,
				prompt: body.prompt,
				voice: parsedVoice,
				promptRefinement:
					promptTraining === null ? undefined : promptTraining,
				subAgents: subAgentsResult.value,
			});
			writeFileSync(join(agentsDir, "agent.md"), agentMarkdown);

			const agentList = config.agents?.list || [];
			agentList.push({
				id,
				name: body.displayName || id,
			});
			const nextConfig = {
				...config,
				agents: {
					list: agentList,
					bindings: config.agents?.bindings || [],
				},
			};
			ctx.setWingmanConfig(nextConfig);
			ctx.setRouter(new GatewayRouter(nextConfig));
			ctx.persistWingmanConfig();

			return new Response(
				JSON.stringify(
					{
						id,
						displayName: body.displayName || id,
						description: body.description,
						tools,
						model: body.model,
						voice: parsedVoice,
						...mapPromptTrainingFields(
							promptTraining === null ? undefined : promptTraining,
						),
						subAgents: subAgentsResult.value.map((sub) =>
							mapSubAgentForResponse(sub),
						),
					},
					null,
					2,
				),
				{ headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response("Method Not Allowed", { status: 405 });
	}

	const agentDetailMatch = url.pathname.match(/^\/api\/agents\/([^/]+)$/);
	if (!agentDetailMatch) {
		return null;
	}

	const agentId = decodeURIComponent(agentDetailMatch[1]);
	const loader = new AgentLoader(ctx.configDir, ctx.workspace, config);
	const configs = loader.loadAllAgentConfigs();
	const agentConfig = configs.find((item) => item.name === agentId);
	const displayName =
		config.agents?.list?.find((agent) => agent.id === agentId)?.name || agentId;

	if (req.method === "GET") {
		if (!agentConfig) {
			return new Response("Agent not found", { status: 404 });
		}

		return new Response(
			JSON.stringify(
				{
					id: agentConfig.name,
					displayName,
					description: agentConfig.description,
					tools: agentConfig.tools || [],
					model: agentConfig.model,
					voice: agentConfig.voice,
					...mapPromptTrainingFields(agentConfig.promptRefinement),
					subAgents:
						agentConfig.subAgents?.map((sub) => mapSubAgentForResponse(sub)) ||
						[],
					prompt: agentConfig.systemPrompt,
				},
				null,
				2,
			),
			{ headers: { "Content-Type": "application/json" } },
		);
	}

	if (req.method === "PUT") {
		if (!agentConfig) {
			return new Response("Agent not found", { status: 404 });
		}
		const body = (await req.json()) as {
			displayName?: string;
			description?: string;
			model?: string;
			tools?: string[];
			prompt?: string;
			voice?: Record<string, any>;
			promptTraining?: PromptTrainingConfig | null;
			promptRefinement?: PromptTrainingConfig | null;
			subAgents?: SubAgentApiPayload[] | null;
			subagents?: SubAgentApiPayload[] | null;
		};
		let parsedVoice: Record<string, any> | undefined | null = undefined;
		if (body?.voice === null) {
			parsedVoice = null;
		} else if (body?.voice !== undefined) {
			const voiceResult = AgentVoiceConfigSchema.safeParse(body.voice);
			if (!voiceResult.success) {
				return new Response("Invalid voice configuration", { status: 400 });
			}
			parsedVoice = voiceResult.data;
		}

		const tools = Array.isArray(body.tools)
			? body.tools.filter((tool) => getAvailableTools().includes(tool as any))
			: agentConfig.tools || [];

		const nextDescription = body.description ?? agentConfig.description;
		const nextModel = body.model ?? agentConfig.model;
		const nextPrompt = body.prompt ?? agentConfig.systemPrompt;
		const nextVoice =
			parsedVoice === undefined ? agentConfig.voice : parsedVoice;
		const bodyPromptTraining = getPromptTrainingFromPayload(
			body as Record<string, any>,
		);
		if (
			bodyPromptTraining !== undefined &&
			bodyPromptTraining !== null &&
			typeof bodyPromptTraining !== "boolean" &&
			(typeof bodyPromptTraining !== "object" ||
				Array.isArray(bodyPromptTraining))
		) {
			return new Response("Invalid promptTraining configuration", {
				status: 400,
			});
		}
		const nextPromptRefinement =
			bodyPromptTraining === undefined
				? agentConfig.promptRefinement
				: bodyPromptTraining === null
					? undefined
					: bodyPromptTraining;
		const hasSubAgents = hasOwn(body, "subAgents") || hasOwn(body, "subagents");
		const rawSubAgents = hasOwn(body, "subAgents")
			? body.subAgents
			: body.subagents;
		const subAgentsResult = normalizeSubAgents(rawSubAgents);
		if (!subAgentsResult.ok) {
			return new Response(subAgentsResult.error, { status: 400 });
		}
		const nextSubAgents = hasSubAgents
			? subAgentsResult.value
			: agentConfig.subAgents || [];

		const agentsDir = join(ctx.resolveConfigDirPath(), "agents", agentId);
		const agentJsonPath = join(agentsDir, "agent.json");
		const agentMarkdownPath = join(agentsDir, "agent.md");
		const hasJson = existsSync(agentJsonPath);
		const hasMarkdown = existsSync(agentMarkdownPath);

		if (!hasJson && !hasMarkdown) {
			return new Response("Agent not found", { status: 404 });
		}

		if (hasJson) {
			const raw = readFileSync(agentJsonPath, "utf-8");
			const parsed = JSON.parse(raw) as Record<string, any>;
			parsed.name = agentId;
			parsed.description = nextDescription;
			parsed.tools = tools;
			if (nextModel) {
				parsed.model = nextModel;
			} else {
				delete parsed.model;
			}
			parsed.systemPrompt = nextPrompt;
			if (nextVoice) {
				parsed.voice = nextVoice;
			} else {
				delete parsed.voice;
			}
			if (nextPromptRefinement !== undefined) {
				parsed.promptRefinement = nextPromptRefinement;
			} else {
				delete parsed.promptRefinement;
			}
			if (nextSubAgents.length > 0) {
				parsed.subAgents = nextSubAgents;
			} else {
				delete parsed.subAgents;
				delete parsed.subagents;
			}
			writeFileSync(agentJsonPath, JSON.stringify(parsed, null, 2));
		} else if (hasMarkdown) {
			const raw = readFileSync(agentMarkdownPath, "utf-8");
			const { metadata } = parseAgentMarkdown(raw);
			metadata.name = agentId;
			metadata.description = nextDescription;
			metadata.tools = tools;
			if (nextModel) {
				metadata.model = nextModel;
			} else {
				delete metadata.model;
			}
			if (nextVoice) {
				metadata.voice = nextVoice;
			} else {
				delete metadata.voice;
			}
			if (nextPromptRefinement !== undefined) {
				metadata.promptRefinement = nextPromptRefinement;
			} else {
				delete metadata.promptRefinement;
			}
			if (nextSubAgents.length > 0) {
				metadata.subAgents = nextSubAgents;
			} else {
				delete metadata.subAgents;
				delete metadata.subagents;
			}
			const updatedMarkdown = serializeAgentMarkdown(metadata, nextPrompt);
			writeFileSync(agentMarkdownPath, updatedMarkdown);
		}

		if (config.agents?.list) {
			const nextList = config.agents.list.map((agent) =>
				agent.id === agentId
					? { ...agent, name: body.displayName || agent.name || agentId }
					: agent,
			);
			const nextConfig = {
				...config,
				agents: {
					list: nextList,
					bindings: config.agents?.bindings || [],
				},
			};
			ctx.setWingmanConfig(nextConfig);
			ctx.setRouter(new GatewayRouter(nextConfig));
			ctx.persistWingmanConfig();
		}

		return new Response(
			JSON.stringify(
				{
					id: agentId,
					displayName: body.displayName || displayName || agentId,
					description: nextDescription,
					tools,
					model: nextModel,
					voice: nextVoice,
					...mapPromptTrainingFields(nextPromptRefinement),
					subAgents: nextSubAgents.map((sub) => mapSubAgentForResponse(sub)),
					prompt: nextPrompt,
				},
				null,
				2,
			),
			{ headers: { "Content-Type": "application/json" } },
		);
	}

	return new Response("Method Not Allowed", { status: 405 });
};
