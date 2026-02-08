import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ToolCallBlock } from "../../types.js";
import {
	extractSubagentName,
	extractTaskSummary,
	isTaskTool,
} from "../toolDisplayHelpers.js";

interface ToolCallDisplayProps {
	tool: ToolCallBlock;
}

interface ToolStyle {
	icon: string;
	color: string;
	label: string;
}

const MAX_PREVIEW_LENGTH = 120;
const MAX_ARG_LENGTH = 30;
const MAX_ARG_ITEMS = 2;

// Tool type styling configuration
const TOOL_STYLES: Record<string, ToolStyle> = {
	Read: { icon: "📖", color: "cyan", label: "Reading" },
	Write: { icon: "✏️", color: "green", label: "Writing" },
	Edit: { icon: "📝", color: "yellow", label: "Editing" },
	Grep: { icon: "🔎", color: "blue", label: "Searching" },
	Glob: { icon: "🔍", color: "magenta", label: "Finding" },
	Bash: { icon: "⚙️", color: "yellow", label: "Running" },
	Task: { icon: "🧠", color: "magenta", label: "Delegating" },
	WebFetch: { icon: "🌐", color: "blue", label: "Fetching" },
	WebSearch: { icon: "🔍", color: "blue", label: "Searching" },
	AskUserQuestion: { icon: "❓", color: "magenta", label: "Asking" },
	default: { icon: "🔧", color: "white", label: "Using" },
};

function getToolStyle(toolName: string): ToolStyle {
	// Try exact match first
	if (TOOL_STYLES[toolName]) {
		return TOOL_STYLES[toolName];
	}

	// Try case-insensitive partial match
	const lowerName = toolName.toLowerCase();
	for (const [key, style] of Object.entries(TOOL_STYLES)) {
		if (lowerName.includes(key.toLowerCase())) {
			return style;
		}
	}

	return TOOL_STYLES.default;
}

function getStatusIndicator(status: ToolCallBlock["status"]): React.ReactElement {
	switch (status) {
		case "running":
			return (
				<Text color="yellow">
					<Spinner type="dots" /> running
				</Text>
			);
		case "complete":
			return <Text color="green">✓ done</Text>;
		case "error":
			return <Text color="red">✗ error</Text>;
	}
}

function formatDuration(startTime: number, endTime?: number): string {
	if (!endTime) return "";
	const duration = (endTime - startTime) / 1000;
	return `(${duration.toFixed(2)}s)`;
}

function formatArgValue(value: unknown, maxLength: number): string {
	let raw: string;
	if (typeof value === "string") {
		raw = value;
	} else {
		try {
			raw = JSON.stringify(value);
		} catch {
			raw = String(value);
		}
	}
	const trimmed = raw.replace(/\s+/g, " ").trim();
	if (trimmed.length <= maxLength) return trimmed;
	return `${trimmed.slice(0, maxLength)}...`;
}

function formatArgs(args: Record<string, any>): string {
	const entries = Object.entries(args);
	if (entries.length === 0) return "";
	const shown = entries.slice(0, MAX_ARG_ITEMS);
	const formatted = shown
		.map(([key, value]) => `${key}=${formatArgValue(value, MAX_ARG_LENGTH)}`)
		.join(", ");
	const remaining = entries.length - shown.length;
	return remaining > 0 ? `${formatted} (+${remaining})` : formatted;
}

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({ tool }) => {
	const style = getToolStyle(tool.name);
	const duration = formatDuration(tool.startTime, tool.endTime);
	const isTask = isTaskTool(tool.name);
	const taskTarget = isTask ? extractSubagentName(tool.args) : null;
	const taskSummary = isTask ? extractTaskSummary(tool.args) : null;
	const hasArgs = Object.keys(tool.args).length > 0;
	const argsText = hasArgs ? formatArgs(tool.args) : "";
	const result = tool.result;
	const hasResult = !!result;
	const hasError = !!result?.error;
	const outputLength = result?.output.length ?? 0;
	const isLong = outputLength > MAX_PREVIEW_LENGTH;
	const preview = result?.output
		? isLong
			? `${result.output.substring(0, MAX_PREVIEW_LENGTH)}...`
			: result.output
		: "";

	return (
		<Box flexDirection="column" marginY={1}>
			<Box borderStyle="single" borderColor={style.color as any} paddingX={1}>
				<Box flexDirection="column" width="100%">
					{/* Header */}
					<Box>
						<Text>
							{style.icon}{" "}
							<Text bold color={style.color as any}>
								{isTask ? "Subagent" : tool.name}
							</Text>{" "}
							{isTask && taskTarget ? (
								<Text dimColor>→ {taskTarget}</Text>
							) : null}{" "}
							{duration && <Text dimColor>{duration}</Text>}{" "}
							{getStatusIndicator(tool.status)}
						</Text>
					</Box>

					{isTask ? (
						<Box marginTop={1}>
							<Text dimColor>
								{taskTarget ? `target: ${taskTarget}` : "delegating subtask"}
								{taskSummary
									? ` • task: ${formatArgValue(taskSummary, MAX_PREVIEW_LENGTH)}`
									: ""}
							</Text>
						</Box>
					) : hasArgs ? (
						<Box marginTop={1}>
							<Text dimColor>args: {argsText}</Text>
						</Box>
					) : null}

					{hasResult && (
						<Box flexDirection="column" marginTop={1}>
							{hasError && result?.error && (
								<Text color="red">
									error: {formatArgValue(result.error, MAX_PREVIEW_LENGTH)}
								</Text>
							)}
							{!hasError && result?.output && (
								<Text dimColor>
									out: {preview}
									{isLong ? "..." : ""}
									{result.truncated ? " (truncated)" : ""}
								</Text>
							)}
						</Box>
					)}
				</Box>
			</Box>
		</Box>
	);
};
