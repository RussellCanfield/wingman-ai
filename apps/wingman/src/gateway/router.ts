import type { WingmanConfigType } from "../cli/config/schema.js";
import type { RoutingInfo } from "./types.js";

export class GatewayRouter {
	constructor(private config: WingmanConfigType) {}

	selectAgent(explicitAgentId?: string, routing?: RoutingInfo): string | undefined {
		if (explicitAgentId) {
			return explicitAgentId;
		}

		const bindings = this.config.agents?.bindings ?? [];
		if (routing) {
			for (const binding of bindings) {
				if (this.matches(binding.match, routing)) {
					return binding.agentId;
				}
			}
		}

		return (
			this.config.defaultAgent ||
			this.config.agents?.list?.find((agent) => agent.default)?.id ||
			this.config.agents?.list?.[0]?.id
		);
	}

	buildSessionKey(agentId: string, routing?: RoutingInfo): string {
		if (!routing) {
			return `agent:${agentId}:main`;
		}

		if (routing.peer?.kind === "dm") {
			return `agent:${agentId}:main`;
		}

		const parts: string[] = ["agent", agentId, routing.channel];

		if (routing.accountId) {
			parts.push("account", routing.accountId);
		}

		if (routing.peer) {
			parts.push(routing.peer.kind, routing.peer.id);
		}

		if (routing.threadId) {
			parts.push("thread", routing.threadId);
		}

		if (parts.length === 3) {
			parts.push("main");
		}

		return parts.join(":");
	}

	private matches(
		match: {
			channel: string;
			accountId?: string;
			guildId?: string;
			teamId?: string;
			peer?: { kind: string; id: string };
		},
		routing: RoutingInfo,
	): boolean {
		if (match.channel !== routing.channel) {
			return false;
		}
		if (match.accountId && match.accountId !== routing.accountId) {
			return false;
		}
		if (match.guildId && match.guildId !== routing.guildId) {
			return false;
		}
		if (match.teamId && match.teamId !== routing.teamId) {
			return false;
		}
		if (match.peer) {
			if (!routing.peer) {
				return false;
			}
			if (match.peer.kind !== routing.peer.kind) {
				return false;
			}
			if (match.peer.id !== routing.peer.id) {
				return false;
			}
		}

		return true;
	}
}
