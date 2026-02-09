export const agentSyncNotice = {
	heading: "Agent Sync",
	body: "If your local `.wingman/agents/` is missing bundled agents (or you want fresh templates), re-copy them without changing config/provider setup:",
	commands: [
		"wingman init --skip-config --skip-provider",
		"wingman init --skip-config --skip-provider --agents main,coding",
		"wingman init --skip-config --skip-provider --force",
	],
	note: "These commands only sync bundled agent templates.",
} as const;
