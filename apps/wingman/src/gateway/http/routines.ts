import { AgentLoader } from "@/agent/config/agentLoader.js";
import type { GatewayHttpContext } from "./types.js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type RoutineConfig = {
	id: string;
	name: string;
	agentId: string;
	cron: string;
	prompt: string;
	sessionId?: string;
	createdAt: number;
	lastRunAt?: number;
	enabled: boolean;
};

type RoutineStore = {
	load: () => RoutineConfig[];
	save: (routines: RoutineConfig[]) => void;
	generateId: () => string;
};

const CRON_FIELD_PATTERN = /^[0-9*/,\-]+$/;

const isValidCron = (cron: string): boolean => {
	const parts = cron.trim().split(/\s+/);
	if (parts.length !== 5) return false;
	return parts.every((part) => CRON_FIELD_PATTERN.test(part));
};

export const createRoutineStore = (
	resolveConfigDirPath: () => string,
): RoutineStore => {
	const resolvePath = () => {
		const configDir = resolveConfigDirPath();
		mkdirSync(configDir, { recursive: true });
		return join(configDir, "routines.json");
	};

	return {
		load: () => {
			const path = resolvePath();
			if (!existsSync(path)) {
				return [];
			}
			try {
				const raw = readFileSync(path, "utf-8");
				const parsed = JSON.parse(raw);
				return Array.isArray(parsed) ? (parsed as RoutineConfig[]) : [];
			} catch {
				return [];
			}
		},
		save: (routines: RoutineConfig[]) => {
			const path = resolvePath();
			writeFileSync(path, JSON.stringify(routines, null, 2));
		},
		generateId: () => `routine-${randomUUID()}`,
	};
};

const agentExists = (ctx: GatewayHttpContext, agentId: string): boolean => {
	const loader = new AgentLoader(
		ctx.configDir,
		ctx.workspace,
		ctx.getWingmanConfig(),
	);
	const configs = loader.loadAllAgentConfigs();
	return Boolean(configs.find((config) => config.name === agentId));
};

const sessionExists = async (
	ctx: GatewayHttpContext,
	agentId: string,
	sessionId: string,
): Promise<boolean> => {
	const manager = await ctx.getSessionManager(agentId);
	return Boolean(manager.getSession(sessionId));
};

export const handleRoutinesApi = async (
	ctx: GatewayHttpContext,
	store: RoutineStore,
	req: Request,
	url: URL,
): Promise<Response | null> => {
	if (url.pathname === "/api/routines") {
		if (req.method === "GET") {
			const routines = store.load();
			return new Response(JSON.stringify(routines, null, 2), {
				headers: { "Content-Type": "application/json" },
			});
		}

		if (req.method === "POST") {
			let body: {
				id?: string;
				name?: string;
				agentId?: string;
				cron?: string;
				prompt?: string;
				sessionId?: string;
				enabled?: boolean;
			};
			try {
				body = (await req.json()) as typeof body;
			} catch {
				return new Response("Invalid JSON body", { status: 400 });
			}

			const name = body?.name?.trim();
			const agentId = body?.agentId?.trim();
			const cron = body?.cron?.trim();
			const prompt = body?.prompt?.trim();
			if (!name) {
				return new Response("Routine name required", { status: 400 });
			}
			if (!agentId) {
				return new Response("agentId required", { status: 400 });
			}
			if (!cron) {
				return new Response("cron required", { status: 400 });
			}
			if (!prompt) {
				return new Response("prompt required", { status: 400 });
			}
			if (!isValidCron(cron)) {
				return new Response("Invalid cron expression", { status: 400 });
			}
			if (!agentExists(ctx, agentId)) {
				return new Response("Invalid agentId", { status: 400 });
			}

			const sessionId = body?.sessionId?.trim();
			if (sessionId) {
				const exists = await sessionExists(ctx, agentId, sessionId);
				if (!exists) {
					return new Response("Invalid sessionId", { status: 400 });
				}
			}

			const routines = store.load();
			const providedId = body?.id?.trim();
			if (providedId && !/^[a-zA-Z0-9_-]+$/.test(providedId)) {
				return new Response("Invalid routine id", { status: 400 });
			}
			const id = providedId || store.generateId();
			if (routines.some((routine) => routine.id === id)) {
				return new Response("Routine already exists", { status: 409 });
			}

			const routine: RoutineConfig = {
				id,
				name,
				agentId,
				cron,
				prompt,
				sessionId: sessionId || undefined,
				createdAt: Date.now(),
				enabled: body?.enabled ?? true,
			};

			routines.unshift(routine);
			store.save(routines);

			return new Response(JSON.stringify(routine, null, 2), {
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response("Method Not Allowed", { status: 405 });
	}

	const routineMatch = url.pathname.match(/^\/api\/routines\/([^/]+)$/);
	if (!routineMatch) {
		return null;
	}

	const routineId = decodeURIComponent(routineMatch[1]);
	const routines = store.load();
	const routine = routines.find((item) => item.id === routineId);

	if (req.method === "GET") {
		if (!routine) {
			return new Response("Routine not found", { status: 404 });
		}
		return new Response(JSON.stringify(routine, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	if (req.method === "DELETE") {
		if (!routine) {
			return new Response("Routine not found", { status: 404 });
		}
		const nextRoutines = routines.filter((item) => item.id !== routineId);
		store.save(nextRoutines);
		return new Response(JSON.stringify({ ok: true }, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response("Method Not Allowed", { status: 405 });
};
