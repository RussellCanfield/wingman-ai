import type { GatewayRouter } from "../router.js";
import type { GatewayAuth } from "../auth.js";
import type { Logger } from "@/logger.js";
import type { WingmanConfigType } from "@/cli/config/schema.js";
import type { SessionManager } from "@/cli/core/sessionManager.js";

export type GatewayHttpContext = {
	workspace: string;
	configDir: string;
	getWingmanConfig: () => WingmanConfigType;
	setWingmanConfig: (config: WingmanConfigType) => void;
	persistWingmanConfig: () => void;
	router: GatewayRouter;
	setRouter: (router: GatewayRouter) => void;
	auth: GatewayAuth;
	logger: Logger;
	getSessionManager: (agentId: string) => Promise<SessionManager>;
	resolveConfigDirPath: () => string;
	resolveOutputRoot: () => string;
	resolveDefaultOutputDir: (agentId: string) => string;
	resolveAgentWorkspace: (agentId: string) => string;
	resolveFsRoots: () => string[];
	resolveFsPath: (path: string) => string;
	isPathWithinRoots: (path: string, roots: string[]) => boolean;
	getBuiltInTools: () => string[];
};
