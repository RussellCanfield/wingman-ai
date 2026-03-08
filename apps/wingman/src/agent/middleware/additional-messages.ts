import { isAbsolute, relative } from "node:path";
import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { MIDDLEWARE_BRAND, type AgentMiddleware } from "langchain";
import { getConfidentialityNotice } from "../utils";
import {
	loadUiRegistry,
	resolveUiRegistryPath,
	summarizeUiRegistry,
} from "../uiRegistry.js";

export type ConnectedNodeTarget = {
	nodeId: string;
	clientId?: string;
	name?: string;
	capabilities?: string[];
};

type AdditionalMessageContext = {
	workspaceRoot?: string | null;
	workdir?: string | null;
	defaultOutputDir?: string | null;
	outputVirtualPath?: string | null;
	dynamicUiEnabled?: boolean;
	skillsDirectory?: string;
	nodeConnectedIdsProvider?: () => string[] | Promise<string[]>;
	nodeConnectedTargetsProvider?: () =>
		| ConnectedNodeTarget[]
		| Promise<ConnectedNodeTarget[]>;
	defaultNodeTargetClientId?: string;
};
const INJECTION_SOURCE = "additional-message-middleware";

const normalizeRelativePath = (value: string): string =>
	value.replace(/\\/g, "/");

const toSafeRelativePath = (
	workspaceRoot: string | null | undefined,
	targetPath: string,
): string | null => {
	if (!workspaceRoot) return null;
	const rel = relative(workspaceRoot, targetPath);
	if (!rel || rel === ".") return ".";
	if (rel.startsWith("..") || isAbsolute(rel)) return null;
	const normalized = normalizeRelativePath(rel).replace(/^\.?\//, "");
	return `./${normalized}`;
};

const buildOutputLocationMessage = (
	context: AdditionalMessageContext,
): string | null => {
	const targetPath = context.workdir || context.defaultOutputDir;
	if (!targetPath) return null;

	const locationLabel = context.workdir
		? "session output directory"
		: "default output directory";
	const safePath = toSafeRelativePath(context.workspaceRoot, targetPath);
	const virtualPath = context.outputVirtualPath?.trim();
	const locationLine = safePath
		? `- Use the ${locationLabel}: ${safePath}`
		: virtualPath
			? `- Use the ${locationLabel}: ${virtualPath}`
			: `- Use the ${locationLabel} (path hidden).`;

	return [
		"** Output Location **",
		locationLine,
		"- If the user asks for a location, provide a relative path and avoid absolute paths or usernames.",
	].join("\n");
};

const buildWorkingDirectoryMessage = (
	context: AdditionalMessageContext,
): string | null => {
	if (!context.workspaceRoot) return null;

	return [
		"** Working Directory **",
		"- Treat `./` as the current working directory for file and tool operations in this session.",
		"- Use relative paths such as `./test.md`; do not prepend the working directory absolute path.",
	].join("\n");
};

const buildSessionArtifactsMessage = (): string =>
	[
		"** Session Artifacts **",
		"- Treat /conversation_history as an internal summarization archive, not working context.",
		"- Do not inspect conversation history files through file tools or shell commands during normal task work.",
		"- Prefer the current thread state and /memories/ for durable context.",
	].join("\n");

const resolveConnectedNodeIds = async (
	context: AdditionalMessageContext,
): Promise<string[]> => {
	if (context.nodeConnectedTargetsProvider) {
		try {
			const rawTargets = await context.nodeConnectedTargetsProvider();
			if (!Array.isArray(rawTargets)) {
				return [];
			}
			const seen = new Set<string>();
			const normalized: string[] = [];
			for (const target of rawTargets) {
				if (!target || typeof target !== "object") continue;
				const nodeId = (target as ConnectedNodeTarget).nodeId?.trim();
				if (!nodeId || seen.has(nodeId)) continue;
				seen.add(nodeId);
				normalized.push(nodeId);
			}
			return normalized;
		} catch {
			return [];
		}
	}
	if (!context.nodeConnectedIdsProvider) {
		return [];
	}
	try {
		const rawIds = await context.nodeConnectedIdsProvider();
		if (!Array.isArray(rawIds)) {
			return [];
		}
		const seen = new Set<string>();
		const normalized: string[] = [];
		for (const value of rawIds) {
			if (typeof value !== "string") continue;
			const trimmed = value.trim();
			if (!trimmed || seen.has(trimmed)) continue;
			seen.add(trimmed);
			normalized.push(trimmed);
		}
		return normalized;
	} catch {
		return [];
	}
};

const resolveConnectedNodeTargets = async (
	context: AdditionalMessageContext,
): Promise<ConnectedNodeTarget[]> => {
	if (context.nodeConnectedTargetsProvider) {
		try {
			const rawTargets = await context.nodeConnectedTargetsProvider();
			if (!Array.isArray(rawTargets)) {
				return [];
			}
			const seen = new Set<string>();
			const normalized: ConnectedNodeTarget[] = [];
			for (const target of rawTargets) {
				if (!target || typeof target !== "object") continue;
				const typedTarget = target as ConnectedNodeTarget;
				const nodeId = typedTarget.nodeId?.trim();
				if (!nodeId || seen.has(nodeId)) continue;
				seen.add(nodeId);
				const rawCapabilities = typedTarget.capabilities;
				const capabilities = Array.isArray(rawCapabilities)
					? rawCapabilities
							.filter((value): value is string => typeof value === "string")
							.map((value) => value.trim())
							.filter(Boolean)
					: [];
				normalized.push({
					nodeId,
					clientId: typedTarget.clientId?.trim() || undefined,
					name: typedTarget.name?.trim() || undefined,
					capabilities: capabilities.length > 0 ? capabilities : undefined,
				});
			}
			return normalized;
		} catch {
			return [];
		}
	}

	const nodeIds = await resolveConnectedNodeIds(context);
	return nodeIds.map((nodeId) => ({ nodeId }));
};

const buildNodeTargetsMessage = async (
	context: AdditionalMessageContext,
): Promise<string | null> => {
	const connectedNodeTargets = await resolveConnectedNodeTargets(context);
	const connectedNodeIds = connectedNodeTargets.map((target) => target.nodeId);
	const defaultClientId = context.defaultNodeTargetClientId?.trim();
	if (connectedNodeIds.length === 0 && !defaultClientId) {
		return null;
	}

	const lines = ["** Connected Node Targets **"];
	if (connectedNodeIds.length > 0) {
		lines.push(`- Connected node IDs: ${connectedNodeIds.join(", ")}`);
	} else {
		lines.push("- Connected node IDs: (none currently connected)");
	}
	const withMetadata = connectedNodeTargets.filter(
		(target) =>
			Boolean(target.clientId) ||
			Boolean(target.name) ||
			(target.capabilities && target.capabilities.length > 0),
	);
	if (withMetadata.length > 0) {
		lines.push("- Connected node metadata:");
		for (const target of withMetadata.slice(0, 8)) {
			const details: string[] = [];
			if (target.clientId) {
				details.push(`clientId: ${target.clientId}`);
			}
			if (target.name) {
				details.push(`name: ${target.name}`);
			}
			if (target.capabilities && target.capabilities.length > 0) {
				const preview = target.capabilities.slice(0, 6).join(", ");
				const remaining = target.capabilities.length - 6;
				details.push(
					remaining > 0
						? `capabilities: ${preview} (+${remaining} more)`
						: `capabilities: ${preview}`,
				);
			}
			if (details.length > 0) {
				lines.push(`  - ${target.nodeId} (${details.join("; ")})`);
			}
		}
		if (withMetadata.length > 8) {
			lines.push(`  - ... ${withMetadata.length - 8} more connected node(s)`);
		}
	}
	if (defaultClientId) {
		lines.push(
			`- Default node target clientId for this request: ${defaultClientId}`,
		);
	}
	lines.push(
		"- For node_notify/node_run, set target.nodeId or target.clientId when the user specifies a device.",
	);
	return lines.join("\n");
};

export const additionalMessageMiddleware = (
	context: AdditionalMessageContext = {},
): AgentMiddleware => {
	return {
		name: INJECTION_SOURCE,
		[MIDDLEWARE_BRAND]: true,
		beforeAgent: async (input: {
			messages: BaseMessage[];
		}): Promise<{
			messages: BaseMessage[];
		}> => {
			const messagesWithoutInjected = input.messages.filter(
				(message) =>
					(message as { additional_kwargs?: { source?: string } })
						?.additional_kwargs?.source !== INJECTION_SOURCE,
			);

			const lines = [
				getConfidentialityNotice(),
				`** Current Date Time (UTC): ${new Date().toISOString()} **`,
			];

			const outputLocation = buildOutputLocationMessage(context);
			if (outputLocation) {
				lines.push(outputLocation);
			}
			const workingDirectory = buildWorkingDirectoryMessage(context);
			if (workingDirectory) {
				lines.push(workingDirectory);
			}
			lines.push(buildSessionArtifactsMessage());
			const nodeTargets = await buildNodeTargetsMessage(context);
			if (nodeTargets) {
				lines.push(nodeTargets);
			}

			lines.push(
				"** Long-term memory **\n" +
					"- Use /memories/ for durable notes across threads.\n" +
					"- Store stable preferences, project context, decisions, and research notes.\n" +
					"- Avoid transient logs; keep entries concise and organized.\n" +
					"- Suggested paths: /memories/preferences.md, /memories/projects/<name>/context.md, /memories/projects/<name>/decisions.md",
			);

			if (context.dynamicUiEnabled === false) {
				lines.push(
					"** Dynamic UI **\n" +
						"- Dynamic UI rendering is disabled for this gateway.\n" +
						"- Respond with plain text and avoid calling UI presentation tools.",
				);
			} else {
				const skillsDir = context.skillsDirectory || "skills";
				const resolution = await resolveUiRegistryPath(
					context.workspaceRoot || process.cwd(),
					skillsDir,
				);
				const registry = resolution
					? await loadUiRegistry(resolution.path)
					: null;
				if (registry) {
					const summary = summarizeUiRegistry(registry);
					const summaryLines =
						summary.length > 0
							? summary.join("\n")
							: "- (no UI components registered)";
					lines.push(
						"** Dynamic UI Registry **\n" +
							summaryLines +
							"\n- Use ui_registry_get for schema details, then ui_present with textFallback.",
					);
				}
			}

			return {
				...input,
				messages: [
					new HumanMessage({
						content: lines.join("\n\n"),
						additional_kwargs: {
							ui_hidden: true,
							source: INJECTION_SOURCE,
						},
					}),
					...messagesWithoutInjected,
				],
			};
		},
	};
};
