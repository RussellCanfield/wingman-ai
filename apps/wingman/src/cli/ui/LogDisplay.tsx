import React from "react";
import { Text, Box } from "ink";
import type { LogLevel } from "../../logger.js";

export interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	args?: any[];
}

export interface LogDisplayProps {
	logs: LogEntry[];
	maxLogs?: number;
}

export const LogDisplay: React.FC<LogDisplayProps> = ({
	logs,
	maxLogs = 100,
}) => {
	// Show only the last N logs
	const displayLogs = logs.slice(-maxLogs);

	const getColor = (level: LogLevel): string => {
		switch (level) {
			case "debug":
				return "gray";
			case "info":
				return "blue";
			case "warn":
				return "yellow";
			case "error":
				return "red";
			default:
				return "white";
		}
	};

	return (
		<Box flexDirection="column">
			{displayLogs.map((log, index) => (
				<Box key={index} flexDirection="column">
					<Text color={getColor(log.level)}>
						[{log.level.toUpperCase()}] {log.message}
					</Text>
					{log.args && log.args.length > 0 && (
						<Text color="gray">{JSON.stringify(log.args, null, 2)}</Text>
					)}
				</Box>
			))}
		</Box>
	);
};
