import { AgentLoader } from "@/agent/config/agentLoader.js";
import { getAvailableTools } from "@/agent/config/toolRegistry.js";
import { GatewayRouter } from "../router.js";
import type { GatewayHttpContext } from "./types.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { AgentVoiceConfigSchema } from "@/types/voice.js";

const buildAgentMarkdown = (params: {
	id: string;
	description?: string;
	tools: string[];
	model?: string;
	prompt?: string;
	voice?: Record<string, any>;
}): string => {
	const { id, description, tools, model, prompt, voice } = params;
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
				subAgents:
					agent.subAgents?.map((sub) => ({
						id: sub.name,
						displayName: sub.name,
						description: sub.description,
						tools: sub.tools || [],
						model: sub.model,
					})) || [],
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
