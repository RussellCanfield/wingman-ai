import { tool } from "langchain";
import * as z from "zod";

const DEFAULT_NODE_TIMEOUT_MS = 30_000;

export type NodeInvokeRequest = {
	tool: "system.notify" | "system.run";
	args?: Record<string, unknown>;
	timeoutMs?: number;
	targetNodeId?: string;
	targetClientId?: string;
	capability?: string;
};

export type NodeInvokeResult = {
	nodeId: string;
	payload: unknown;
};

export type NodeInvoker = (request: NodeInvokeRequest) => Promise<NodeInvokeResult>;

export interface NodeToolOptions {
	nodeInvoker?: NodeInvoker;
	defaultTargetClientId?: string;
}

const TargetSchema = z
	.object({
		nodeId: z.string().min(1).optional(),
		clientId: z.string().min(1).optional(),
	})
	.optional();

function resolveTarget(
	target: { nodeId?: string; clientId?: string } | undefined,
	defaultTargetClientId: string | undefined,
): { targetNodeId?: string; targetClientId?: string } {
	const targetNodeId = target?.nodeId?.trim();
	if (targetNodeId) {
		return { targetNodeId };
	}
	const targetClientId = target?.clientId?.trim() || defaultTargetClientId?.trim();
	if (targetClientId) {
		return { targetClientId };
	}
	return {};
}

function missingInvokerResult(toolName: string) {
	return {
		ok: false,
		error: `${toolName} is only available when invoked through Wingman Gateway.`,
	};
}

export const createNodeNotifyTool = (options: NodeToolOptions = {}) => {
	const { nodeInvoker, defaultTargetClientId } = options;

	return tool(
		async ({
			body,
			title,
			target,
			timeoutMs,
		}: {
			body: string;
			title?: string;
			target?: { nodeId?: string; clientId?: string };
			timeoutMs?: number;
		}) => {
			if (!nodeInvoker) {
				return missingInvokerResult("node_notify");
			}
			try {
				const { targetNodeId, targetClientId } = resolveTarget(
					target,
					defaultTargetClientId,
				);
				const result = await nodeInvoker({
					tool: "system.notify",
					args: {
						title: title?.trim() || "Wingman",
						body: body.trim(),
					},
					timeoutMs: timeoutMs ?? DEFAULT_NODE_TIMEOUT_MS,
					targetNodeId,
					targetClientId,
					capability: "system.notify",
				});
				const payload =
					result.payload && typeof result.payload === "object"
						? (result.payload as Record<string, unknown>)
						: null;
				return {
					ok: true,
					nodeId: result.nodeId,
					delivered: payload?.delivered === true,
					payload: result.payload,
				};
			} catch (error) {
				return {
					ok: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
		{
			name: "node_notify",
			description:
				"Send a user-visible notification on an approved connected node device via system.notify.",
			schema: z.object({
				body: z
					.string()
					.min(1)
					.describe("Notification body text shown on the node device"),
				title: z
					.string()
					.min(1)
					.optional()
					.describe("Optional notification title"),
				target: TargetSchema.describe(
					"Optional target selector. Use nodeId for a specific node or clientId for a paired device.",
				),
				timeoutMs: z
					.number()
					.int()
					.min(1000)
					.max(120000)
					.optional()
					.describe("Optional timeout for node execution in milliseconds"),
			}),
		},
	);
};

export const createNodeRunTool = (options: NodeToolOptions = {}) => {
	const { nodeInvoker, defaultTargetClientId } = options;

	return tool(
		async ({
			command,
			args,
			target,
			timeoutMs,
		}: {
			command: string;
			args?: string[];
			target?: { nodeId?: string; clientId?: string };
			timeoutMs?: number;
		}) => {
			if (!nodeInvoker) {
				return missingInvokerResult("node_run");
			}
			try {
				const { targetNodeId, targetClientId } = resolveTarget(
					target,
					defaultTargetClientId,
				);
				const result = await nodeInvoker({
					tool: "system.run",
					args: {
						command: command.trim(),
						args: Array.isArray(args) ? args : [],
					},
					timeoutMs: timeoutMs ?? DEFAULT_NODE_TIMEOUT_MS,
					targetNodeId,
					targetClientId,
					capability: "system.run",
				});
				const payload =
					result.payload && typeof result.payload === "object"
						? (result.payload as Record<string, unknown>)
						: null;
				return {
					ok: true,
					nodeId: result.nodeId,
					exitCode:
						typeof payload?.exitCode === "number" ? payload.exitCode : undefined,
					stdout: typeof payload?.stdout === "string" ? payload.stdout : "",
					stderr: typeof payload?.stderr === "string" ? payload.stderr : "",
					payload: result.payload,
				};
			} catch (error) {
				return {
					ok: false,
					error: error instanceof Error ? error.message : String(error),
				};
			}
		},
		{
			name: "node_run",
			description:
				"Run a command on an approved connected node device via system.run and return exitCode/stdout/stderr.",
			schema: z.object({
				command: z
					.string()
					.min(1)
					.describe("Executable command path/name to run on the node device"),
				args: z
					.array(z.string())
					.optional()
					.describe("Optional command arguments"),
				target: TargetSchema.describe(
					"Optional target selector. Use nodeId for a specific node or clientId for a paired device.",
				),
				timeoutMs: z
					.number()
					.int()
					.min(1000)
					.max(120000)
					.optional()
					.describe("Optional timeout for node execution in milliseconds"),
			}),
		},
	);
};
