import "./fetch";
import {
	WingmanAgent,
	type WingmanRequest,
	type BackgroundAgentStatus,
	type BackgroundAgentEventEmitter,
} from "./agent";
import type {
	WingmanGraphState,
	WingmanBackgroundAgentTasks,
} from "./state/graph";
import { getModelCosts } from "./providers/tokenCost";
import { getContextWindow } from "./providers/contextWindows";
import { DEFAULT_BLOCKED_COMMANDS } from "./tools/cmd_execute";
import {
	type Logger,
	type LogLevel,
	WingmanLogger,
	SilentLogger,
	createLogger,
} from "./logger";
import { WingmanAgentConfigSchema } from "./config";

export {
	WingmanAgent,
	getModelCosts,
	getContextWindow,
	DEFAULT_BLOCKED_COMMANDS,
	WingmanAgentConfigSchema,
	WingmanLogger,
	SilentLogger,
	createLogger,
};
export type {
	BackgroundAgentStatus,
	BackgroundAgentEventEmitter,
	WingmanGraphState,
	WingmanRequest,
	WingmanBackgroundAgentTasks,
	Logger,
	LogLevel,
};
