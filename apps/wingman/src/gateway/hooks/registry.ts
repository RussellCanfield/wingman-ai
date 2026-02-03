import type { HookDefinition, HookEvent, HookDeliverConfig, InternalHooksConfig } from "./types.js";
import { InternalHookLoader } from "./loader.js";
import type { GatewayHttpContext } from "../http/types.js";
import { AgentInvoker } from "@/cli/core/agentInvoker.js";
import { OutputManager } from "@/cli/core/outputManager.js";

type EventKey = string;

export class InternalHookRegistry {
	private hooks: HookDefinition[] = [];
	private eventMap = new Map<EventKey, HookDefinition[]>();

	constructor(
		private ctx: GatewayHttpContext,
		private config: InternalHooksConfig | undefined,
	) {}

	async load(): Promise<void> {
		if (!this.config?.enabled) {
			return;
		}
		const loader = new InternalHookLoader(
			this.ctx.resolveConfigDirPath(),
			this.config,
			this.ctx.logger,
		);
		this.hooks = await loader.load();
		this.eventMap.clear();
		for (const hook of this.hooks) {
			for (const eventName of hook.events) {
				const list = this.eventMap.get(eventName) || [];
				list.push(hook);
				this.eventMap.set(eventName, list);
			}
		}
	}

	emit(event: Omit<HookEvent, "messages">): void {
		if (!this.config?.enabled) return;
		const key = `${event.type}:${event.action}`;
		const hooks = [
			...(this.eventMap.get(key) || []),
			...(this.eventMap.get("*") || []),
		];
		if (hooks.length === 0) {
			return;
		}

		for (const hook of hooks) {
			void this.runHook(hook, event);
		}
	}

	private async runHook(hook: HookDefinition, baseEvent: Omit<HookEvent, "messages">) {
		const event: HookEvent = { ...baseEvent, messages: [] };
		try {
			await hook.handler(event);
		} catch (error) {
			this.ctx.logger.error(`Hook ${hook.name} failed`, error);
		}

		if (hook.entry?.deliver) {
			await this.deliverToAgent(hook, event, hook.entry.deliver);
		}
	}

	private async deliverToAgent(
		hook: HookDefinition,
		event: HookEvent,
		deliver: HookDeliverConfig,
	): Promise<void> {
		const agentId =
			deliver.agentId === "last"
				? event.agentId || this.ctx.router.selectAgent()
				: deliver.agentId;

		if (!agentId) {
			this.ctx.logger.warn(`Hook ${hook.name} has no target agent`);
			return;
		}

		const sessionKey =
			deliver.sessionKey ||
			event.sessionKey ||
			`agent:${agentId}:hook:${hook.name}`;

		const message =
			deliver.message ||
			(event.messages.length > 0
				? event.messages.join("\n")
				: event.payload
					? JSON.stringify(event.payload, null, 2)
					: `Hook "${hook.name}" triggered (${event.type}:${event.action}).`);

		try {
			const manager = await this.ctx.getSessionManager(agentId);
			manager.getOrCreateSession(sessionKey, agentId, `Hook: ${hook.name}`);
			manager.updateSession(sessionKey, {
				lastMessagePreview: message.substring(0, 200),
			});
			manager.updateSessionMetadata(sessionKey, {
				source: "hook",
				hookName: hook.name,
				action: `${event.type}:${event.action}`,
			});

			const outputManager = new OutputManager("interactive");
			const workspace = this.ctx.resolveAgentWorkspace(agentId);
			const session = manager.getSession(sessionKey);
			const workdir = session?.metadata?.workdir ?? null;
			const defaultOutputDir = this.ctx.resolveDefaultOutputDir(agentId);

			const invoker = new AgentInvoker({
				workspace,
				configDir: this.ctx.configDir,
				outputManager,
				logger: this.ctx.logger,
				sessionManager: manager,
				workdir,
				defaultOutputDir,
			});

			void invoker.invokeAgent(agentId, message, sessionKey);
		} catch (error) {
			this.ctx.logger.error(`Hook ${hook.name} delivery failed`, error);
		}
	}
}
