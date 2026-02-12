import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { AgentLoader } from "@/agent/config/agentLoader.js";
import type { GatewayHttpContext } from "./types.js";

const getSessionAgents = (
	ctx: GatewayHttpContext,
	explicitAgentId?: string,
): string[] => {
	if (explicitAgentId) {
		return [explicitAgentId];
	}

	const config = ctx.getWingmanConfig();
	const configuredAgents =
		config.agents?.list
			?.map((agent) => agent.id?.trim())
			.filter((id): id is string => Boolean(id)) ?? [];

	let discoveredAgents: string[] = [];
	try {
		const loader = new AgentLoader(ctx.configDir, ctx.workspace, config);
		discoveredAgents = loader
			.loadAllAgentConfigs()
			.map((agent) => agent.name?.trim())
			.filter((id): id is string => Boolean(id));
	} catch (error) {
		if (typeof ctx.logger?.warn === "function") {
			ctx.logger.warn(
				"Failed to load discovered agents while listing sessions",
				error,
			);
		}
	}

	const agents = [...new Set([...configuredAgents, ...discoveredAgents])];
	return agents.length > 0 ? agents : ["main"];
};

export const handleSessionsApi = async (
	ctx: GatewayHttpContext,
	req: Request,
	url: URL,
): Promise<Response | null> => {
	if (url.pathname === "/api/sessions") {
		if (req.method === "GET") {
			const limit = Number(url.searchParams.get("limit") || "100");
			const status =
				(url.searchParams.get("status") as
					| "active"
					| "archived"
					| "deleted"
					| null) || "active";
			const agentId = url.searchParams.get("agentId") || undefined;
			const agents = getSessionAgents(ctx, agentId);

			const sessions: Array<Record<string, unknown>> = [];
			for (const agent of agents) {
				const manager = await ctx.getSessionManager(agent);
				const list = manager.listSessions({
					status,
					limit,
					agentName: agent,
				});
				for (const session of list) {
					sessions.push({
						id: session.id,
						name: session.name,
						agentId: session.agentName,
						createdAt: session.createdAt.getTime(),
						updatedAt: session.updatedAt.getTime(),
						messageCount: session.messageCount,
						lastMessagePreview: session.lastMessagePreview,
						workdir: session.metadata?.workdir ?? null,
					});
				}
			}

			const sorted = sessions.sort((a, b) => {
				const aUpdated = typeof a.updatedAt === "number" ? a.updatedAt : 0;
				const bUpdated = typeof b.updatedAt === "number" ? b.updatedAt : 0;
				return bUpdated - aUpdated;
			});

			return new Response(JSON.stringify(sorted.slice(0, limit)), {
				headers: { "Content-Type": "application/json" },
			});
		}

		if (req.method === "POST") {
			const body = (await req.json()) as {
				agentId?: string;
				name?: string;
				sessionId?: string;
			};
			const selectedAgent = ctx.router.selectAgent(body.agentId);
			if (!selectedAgent) {
				return new Response("Invalid agent", { status: 400 });
			}
			const sessionId =
				body.sessionId || `agent:${selectedAgent}:webui:thread:${randomUUID()}`;

			const manager = await ctx.getSessionManager(selectedAgent);
			const session = manager.getOrCreateSession(
				sessionId,
				selectedAgent,
				body.name,
			);

			return new Response(
				JSON.stringify({
					id: session.id,
					name: session.name,
					agentId: session.agentName,
					createdAt: session.createdAt.getTime(),
					updatedAt: session.updatedAt.getTime(),
					messageCount: session.messageCount,
					lastMessagePreview: session.lastMessagePreview,
					workdir: session.metadata?.workdir ?? null,
				}),
				{ headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response("Method Not Allowed", { status: 405 });
	}

	const sessionMessagesMatch = url.pathname.match(
		/^\/api\/sessions\/(.+)\/messages$/,
	);
	if (sessionMessagesMatch) {
		const sessionId = decodeURIComponent(sessionMessagesMatch[1]);
		const agentId = url.searchParams.get("agentId");
		if (!agentId) {
			return new Response("agentId required", { status: 400 });
		}
		const manager = await ctx.getSessionManager(agentId);

		if (req.method === "GET") {
			const messages = await manager.listMessages(sessionId);
			return new Response(JSON.stringify(messages), {
				headers: { "Content-Type": "application/json" },
			});
		}

		if (req.method === "DELETE") {
			const session = manager.getSession(sessionId);
			if (!session) {
				return new Response("session not found", { status: 404 });
			}
			manager.clearSessionMessages(sessionId);
			const updated = manager.getSession(sessionId);
			return new Response(
				JSON.stringify({
					id: sessionId,
					messageCount: updated?.messageCount ?? 0,
					lastMessagePreview: updated?.lastMessagePreview ?? null,
				}),
				{ headers: { "Content-Type": "application/json" } },
			);
		}
	}

	const sessionWorkdirMatch = url.pathname.match(
		/^\/api\/sessions\/(.+)\/workdir$/,
	);
	if (sessionWorkdirMatch && req.method === "POST") {
		const sessionId = decodeURIComponent(sessionWorkdirMatch[1]);
		const agentId = url.searchParams.get("agentId");
		if (!agentId) {
			return new Response("agentId required", { status: 400 });
		}
		const body = (await req.json()) as { workdir?: string | null };
		const manager = await ctx.getSessionManager(agentId);
		const session = manager.getSession(sessionId);
		if (!session) {
			return new Response("session not found", { status: 404 });
		}

		const rawWorkdir = body?.workdir;
		if (!rawWorkdir) {
			manager.updateSessionMetadata(sessionId, { workdir: null });
			return new Response(
				JSON.stringify({
					id: session.id,
					workdir: null,
				}),
				{ headers: { "Content-Type": "application/json" } },
			);
		}

		const resolved = ctx.resolveFsPath(rawWorkdir);
		const roots = ctx.resolveFsRoots();
		if (!ctx.isPathWithinRoots(resolved, roots)) {
			return new Response("workdir not allowed", { status: 403 });
		}
		if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
			return new Response("workdir not found", { status: 404 });
		}

		manager.updateSessionMetadata(sessionId, { workdir: resolved });
		return new Response(
			JSON.stringify({
				id: session.id,
				workdir: resolved,
			}),
			{ headers: { "Content-Type": "application/json" } },
		);
	}

	const sessionDeleteMatch = url.pathname.match(/^\/api\/sessions\/(.+)$/);
	if (sessionDeleteMatch && req.method === "PUT") {
		const sessionId = decodeURIComponent(sessionDeleteMatch[1]);
		const agentId = url.searchParams.get("agentId");
		if (!agentId) {
			return new Response("agentId required", { status: 400 });
		}
		const body = (await req.json()) as { name?: string };
		const name = body?.name?.trim();
		if (!name) {
			return new Response("name required", { status: 400 });
		}
		const manager = await ctx.getSessionManager(agentId);
		const session = manager.getSession(sessionId);
		if (!session) {
			return new Response("session not found", { status: 404 });
		}

		manager.updateSession(sessionId, { name });
		const updated = manager.getSession(sessionId);
		return new Response(
			JSON.stringify({
				id: updated?.id || sessionId,
				name: updated?.name || name,
				agentId: updated?.agentName || agentId,
				createdAt: updated?.createdAt.getTime() || session.createdAt.getTime(),
				updatedAt: updated?.updatedAt.getTime() || Date.now(),
				messageCount: updated?.messageCount ?? session.messageCount,
				lastMessagePreview:
					updated?.lastMessagePreview ?? session.lastMessagePreview,
				workdir:
					updated?.metadata?.workdir ?? session.metadata?.workdir ?? null,
			}),
			{ headers: { "Content-Type": "application/json" } },
		);
	}

	if (sessionDeleteMatch && req.method === "DELETE") {
		const sessionId = decodeURIComponent(sessionDeleteMatch[1]);
		const agentId = url.searchParams.get("agentId");
		if (!agentId) {
			return new Response("agentId required", { status: 400 });
		}
		const manager = await ctx.getSessionManager(agentId);
		manager.deleteSession(sessionId);
		return new Response(JSON.stringify({ ok: true }), {
			headers: { "Content-Type": "application/json" },
		});
	}

	return null;
};
