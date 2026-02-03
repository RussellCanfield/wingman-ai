import React from "react";
import { Box, Text } from "ink";
import type { Session } from "../core/sessionManager.js";

export interface SessionListDisplayProps {
	sessions: Session[];
}

/**
 * Display a list of sessions in a table format
 */
export const SessionListDisplay: React.FC<SessionListDisplayProps> = ({
	sessions,
}) => {
	if (sessions.length === 0) {
		return (
			<Box flexDirection="column" paddingY={1}>
				<Text color="yellow">No sessions found.</Text>
				<Text dimColor>Use /clear to start a new session.</Text>
			</Box>
		);
	}

	// Helper to format date relative to now
	const formatRelativeTime = (date: Date): string => {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 30) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	};

	// Helper to truncate text
	const truncate = (text: string, maxLen: number): string => {
		if (text.length <= maxLen) return text;
		return text.substring(0, maxLen - 3) + "...";
	};

	return (
		<Box flexDirection="column" paddingY={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					Active Sessions ({sessions.length})
				</Text>
			</Box>

			{/* Header */}
			<Box>
				<Box width={12}>
					<Text bold dimColor>
						ID
					</Text>
				</Box>
				<Box width={25}>
					<Text bold dimColor>
						Name
					</Text>
				</Box>
				<Box width={15}>
					<Text bold dimColor>
						Agent
					</Text>
				</Box>
				<Box width={10}>
					<Text bold dimColor>
						Messages
					</Text>
				</Box>
				<Box width={15}>
					<Text bold dimColor>
						Last Active
					</Text>
				</Box>
			</Box>

			{/* Divider */}
			<Box marginY={0}>
				<Text dimColor>{"─".repeat(77)}</Text>
			</Box>

			{/* Sessions */}
			{sessions.map((session) => (
				<Box key={session.id}>
					<Box width={12}>
						<Text color="gray">{truncate(session.id, 10)}</Text>
					</Box>
					<Box width={25}>
						<Text>{truncate(session.name, 23)}</Text>
					</Box>
					<Box width={15}>
						<Text color="cyan">{truncate(session.agentName, 13)}</Text>
					</Box>
					<Box width={10}>
						<Text color="yellow">{session.messageCount}</Text>
					</Box>
					<Box width={15}>
						<Text dimColor>{formatRelativeTime(session.updatedAt)}</Text>
					</Box>
				</Box>
			))}

			{/* Footer */}
			<Box marginTop={1}>
				<Text dimColor>
					Use /resume {"<id>"} to resume a session, or /clear {"<agent>"} to
					start new
				</Text>
			</Box>
		</Box>
	);
};
