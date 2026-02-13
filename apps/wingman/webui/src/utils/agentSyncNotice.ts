export const agentSyncNotice = {
	heading: "Agent Sync",
	body: "If your local `.wingman/agents/` is missing bundled agents (or you want fresh templates), re-copy them without changing config/provider setup:",
	commands: [
		"wingman init --mode sync --only agents",
		"wingman init --mode sync --only agents --agents main,coding",
		"wingman init --mode sync --only agents --force",
	],
	note: "These commands only sync bundled agent templates.",
} as const;
