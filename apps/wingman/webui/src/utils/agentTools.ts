export const BROWSER_SESSION_TOOL_ALIAS = "browser_session";

export const BROWSER_SESSION_TOOL_MEMBERS = [
	"browser_session_start",
	"browser_session_action",
	"browser_session_close",
	"browser_session_list",
] as const;

const dedupeTools = (tools: string[]): string[] => {
	const seen = new Set<string>();
	const deduped: string[] = [];
	for (const tool of tools) {
		if (seen.has(tool)) continue;
		seen.add(tool);
		deduped.push(tool);
	}
	return deduped;
};

const shouldCollapseBrowserSessionTools = (tools: string[]): boolean => {
	const available = new Set(tools);
	return BROWSER_SESSION_TOOL_MEMBERS.every((tool) => available.has(tool));
};

export const collapseAgentToolsForDisplay = (tools: string[]): string[] => {
	const uniqueTools = dedupeTools(tools);
	if (!shouldCollapseBrowserSessionTools(uniqueTools)) {
		return uniqueTools;
	}

	let insertedAlias = false;
	const collapsed: string[] = [];
	for (const tool of uniqueTools) {
		if (BROWSER_SESSION_TOOL_MEMBERS.includes(tool as never)) {
			if (!insertedAlias) {
				collapsed.push(BROWSER_SESSION_TOOL_ALIAS);
				insertedAlias = true;
			}
			continue;
		}
		collapsed.push(tool);
	}

	return collapsed;
};

export const expandAgentToolsForSave = (tools: string[]): string[] => {
	const expanded: string[] = [];
	for (const tool of dedupeTools(tools)) {
		if (tool === BROWSER_SESSION_TOOL_ALIAS) {
			for (const member of BROWSER_SESSION_TOOL_MEMBERS) {
				if (!expanded.includes(member)) {
					expanded.push(member);
				}
			}
			continue;
		}
		if (!expanded.includes(tool)) {
			expanded.push(tool);
		}
	}
	return expanded;
};

export const buildAgentToolOptions = (
	availableTools: string[],
	selectedTools: string[] = [],
): string[] => {
	const options = collapseAgentToolsForDisplay(availableTools);
	for (const tool of collapseAgentToolsForDisplay(selectedTools)) {
		if (!options.includes(tool)) {
			options.push(tool);
		}
	}
	return options;
};

export const getAgentToolHoverText = (tool: string): string | undefined => {
	switch (tool) {
		case "browser_control":
			return "Run one browser task in a single call. Use this for quick navigation, screenshots, or one-shot extraction. The browser runtime is cleaned up when the call finishes.";
		case BROWSER_SESSION_TOOL_ALIAS:
			return "Start a managed browser session that stays alive across multiple tool calls. Use this for multi-step QA, sign-in flows, or debugging where browser state must persist.";
		default:
			return undefined;
	}
};
