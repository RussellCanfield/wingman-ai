import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import {
	cancel,
	confirm,
	intro,
	isCancel,
	multiselect,
	note,
	outro,
	select,
	spinner,
	text,
} from "@clack/prompts";
import type { InitCommandArgs } from "../types/init.js";
import type { OutputMode } from "../types.js";
import { OutputManager } from "../core/outputManager.js";
import { WingmanConfigSchema } from "../config/schema.js";
import { createLogger, getLogFilePath } from "@/logger.js";
import {
	listProviderSpecs,
	normalizeProviderName,
} from "@/providers/registry.js";
import {
	getCredentialsPath,
	resolveProviderToken,
	saveProviderToken,
} from "@/providers/credentials.js";
import { ModelFactory } from "@/agent/config/modelFactory.js";

export interface InitCommandOptions {
	workspace?: string;
	configDir?: string;
}

const DEFAULT_AGENT_ID = "wingman";
const DEFAULT_AGENT_DESCRIPTION =
	"General-purpose coding assistant for this workspace.";
const DEFAULT_AGENT_PROMPT = [
	"You are Wingman, a coding assistant for this repository.",
	"Be direct and concise. Ask clarifying questions when requirements are unclear.",
	"Prefer minimal diffs and safe changes. Avoid destructive actions unless asked.",
	"Use tools to inspect the codebase before editing.",
].join("\n");
const DEFAULT_TOOLS = [
	"code_search",
	"git_status",
	"command_execute",
	"internet_search",
	"think",
];
const DEFAULT_FS_ROOT = ".";
const DEFAULT_MODELS: Record<string, string> = {
	anthropic: "anthropic:claude-sonnet-4-5",
	openai: "openai:gpt-4o",
	openrouter: "openrouter:openai/gpt-4o",
	copilot: "copilot:gpt-4o",
	xai: "xai:grok-beta",
};

/**
 * Execute the init command
 * This is the handler for: wingman init [options]
 */
export async function executeInitCommand(
	args: InitCommandArgs,
	options: InitCommandOptions = {},
): Promise<void> {
	const outputManager = new OutputManager(args.outputMode);
	const logger = createLogger(args.verbosity);
	const workspace = options.workspace || process.cwd();
	const configDir = options.configDir || ".wingman";
	const configRoot = join(workspace, configDir);
	const configPath = join(configRoot, "wingman.config.json");

	try {
		if (isHelpCommand(args.subcommand)) {
			showInitHelp(outputManager, args.outputMode);
			return;
		}

		const optionMap = args.options || {};
		const nonInteractive =
			outputManager.getMode() !== "interactive" ||
			getBooleanOption(optionMap, ["yes", "non-interactive"], false);
		const skipConfig = getBooleanOption(optionMap, ["skip-config"], false);
		const skipAgent = getBooleanOption(optionMap, ["skip-agent"], false);
		const skipProvider = getBooleanOption(optionMap, ["skip-provider"], false);
		const force = getBooleanOption(optionMap, ["force"], false);
		const merge = getBooleanOption(optionMap, ["merge"], false);
		const fsRoot = getStringOption(optionMap, ["fs-root"]) || DEFAULT_FS_ROOT;

		const useClack = shouldUseClack(outputManager, nonInteractive);
		renderInitBanner(outputManager, nonInteractive);

		const bundledAgentsPath = resolveBundledAgentsPath();
		const bundledAgents = bundledAgentsPath
			? listBundledAgents(bundledAgentsPath)
			: [];

		const explicitAgent =
			Boolean(args.agent?.trim()) ||
			(Boolean(args.subcommand) &&
				!isHelpCommand(args.subcommand) &&
				!args.subcommand.startsWith("-"));

		const agentPlan = await resolveAgentPlan({
			explicitAgent,
			defaultAgentId: resolveAgentId(args),
			bundledAgents,
			nonInteractive,
			optionMap,
			outputManager,
		});

		const providerName = await resolveProviderSelection({
			nonInteractive,
			skipProvider,
			optionMap,
			outputManager,
		});

		const model = await resolveModelSelection({
			nonInteractive,
			optionMap,
			providerName,
			outputManager,
		});

		if (!skipConfig) {
			await runStep(
				useClack,
				"Writing workspace config",
				async () =>
					handleConfigSetup({
						configPath,
						configRoot,
						agentId: agentPlan.defaultAgentId,
						fsRoot,
						force,
						merge,
						nonInteractive,
						outputManager,
					}),
			);
		} else {
			writeLine(outputManager, "Skipping config setup (--skip-config).");
		}

		if (!skipAgent) {
			await runStep(
				useClack,
				"Installing bundled agents",
				async () =>
					handleAgentSetup({
						configRoot,
						agentId: agentPlan.defaultAgentId,
						model,
						force,
						nonInteractive,
						outputManager,
						bundledAgentsPath,
						copyAgents: agentPlan.copyAgents,
					}),
			);
		} else {
			writeLine(outputManager, "Skipping starter agent (--skip-agent).");
		}

		if (!skipProvider) {
			await runStep(
				useClack,
				"Connecting providers",
				async () =>
					handleProviderSetup({
						providerName,
						optionMap,
						nonInteractive,
						outputManager,
					}),
			);
		} else {
			writeLine(outputManager, "Skipping provider setup (--skip-provider).");
		}

		if (useClack) {
			outro(chalk.green("Wingman init complete."));
		} else {
			writeLine(outputManager, "");
			writeLine(outputManager, "Wingman init complete.");
		}
		writeLine(outputManager, `Workspace: ${workspace}`);
		writeLine(outputManager, `Config: ${configPath}`);
		writeLine(
			outputManager,
			`Agent: ${skipAgent ? "skipped" : agentPlan.defaultAgentId}`,
		);

		if (!model) {
			writeLine(
				outputManager,
				"Note: No model set yet. Update your agent config with a model string.",
			);
		}

		writeLine(outputManager, "");
		writeLine(outputManager, "Next steps:");
		writeLine(
			outputManager,
			`  1) wingman agent --local --agent ${agentPlan.defaultAgentId} "hello"`,
		);
		writeLine(outputManager, "  2) wingman gateway start");
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const logFile = getLogFilePath();
		logger.error("Init command failed", { error: errorMsg });

		if (outputManager.getMode() === "interactive") {
			console.error(`\nError: ${errorMsg}`);
			console.error(`Logs: ${logFile}`);
			process.exit(1);
		} else {
			outputManager.emitAgentError(error as Error);
			process.exit(1);
		}
	}
}

function renderInitBanner(
	outputManager: OutputManager,
	nonInteractive: boolean,
): void {
	if (outputManager.getMode() !== "interactive" || nonInteractive) {
		return;
	}

	const title = [
		"__        ___ _   _  ____ __  __    _    _   _",
		"\\ \\      / / | \\ | |/ ___|  \\/  |  / \\  | \\ | |",
		" \\ \\ /\\ / /| |  \\| | |  _| |\\/| | / _ \\ |  \\| |",
		"  \\ V  V / | | |\\  | |_| | |  | |/ ___ \\| |\\  |",
		"   \\_/\\_/  |_|_| \\_|\\____|_|  |_/_/   \\_\\_| \\_|",
	].join("\n");

	const accent = process.stdout.isTTY ? chalk.cyanBright : (text: string) => text;
	const muted = process.stdout.isTTY ? chalk.gray : (text: string) => text;
	const emphasis = process.stdout.isTTY ? chalk.whiteBright : (text: string) => text;

	intro(accent(title));
	note(
		muted(
			"We will set up config, install bundled agents, and connect providers.",
		),
		emphasis("Wingman Init Wizard"),
	);
	note(muted("Press Enter to accept defaults."), emphasis("Tip"));
}

function isHelpCommand(subcommand: string): boolean {
	return ["help", "--help", "-h"].includes(subcommand);
}

function resolveAgentId(args: InitCommandArgs): string {
	if (args.agent && args.agent.trim()) {
		return args.agent.trim();
	}
	if (
		args.subcommand &&
		!isHelpCommand(args.subcommand) &&
		!args.subcommand.startsWith("-")
	) {
		return args.subcommand.trim();
	}
	return DEFAULT_AGENT_ID;
}

async function resolveAgentPlan(input: {
	explicitAgent: boolean;
	defaultAgentId: string;
	bundledAgents: string[];
	nonInteractive: boolean;
	optionMap: Record<string, unknown>;
	outputManager: OutputManager;
}): Promise<{ defaultAgentId: string; copyAgents?: string[] }> {
	const {
		explicitAgent,
		defaultAgentId,
		bundledAgents,
		nonInteractive,
		optionMap,
		outputManager,
	} = input;

	let nextDefaultAgent = sanitizeAgentId(defaultAgentId);
	const availableAgents = bundledAgents.slice();

	if (!explicitAgent && !nonInteractive && availableAgents.length > 0) {
		nextDefaultAgent = await promptForDefaultAgent(
			availableAgents,
			nextDefaultAgent,
		);
	}

	const rawAgentsList = getStringOption(optionMap, ["agents"]);
	if (rawAgentsList) {
		const selected = parseAgentList(rawAgentsList, availableAgents);
		const unique = ensureIncludesDefault(selected, nextDefaultAgent, availableAgents);
		return { defaultAgentId: nextDefaultAgent, copyAgents: unique };
	}

	if (nonInteractive || availableAgents.length === 0) {
		return { defaultAgentId: nextDefaultAgent };
	}

	const copyAll = await promptConfirm(
		"Copy all bundled agents?",
		true,
	);
	if (copyAll) {
		return { defaultAgentId: nextDefaultAgent };
	}

	const selectedAgents = await promptForAgentSelection(
		availableAgents,
		nextDefaultAgent,
	);
	const finalAgents = ensureIncludesDefault(
		selectedAgents,
		nextDefaultAgent,
		availableAgents,
	);

	if (finalAgents.length === 0) {
		writeLine(outputManager, "No bundled agents selected.");
		return { defaultAgentId: nextDefaultAgent, copyAgents: [] };
	}

	return { defaultAgentId: nextDefaultAgent, copyAgents: finalAgents };
}

function sanitizeAgentId(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error("Agent name is required.");
	}
	if (trimmed.includes("/") || trimmed.includes("\\")) {
		throw new Error("Agent name cannot include path separators.");
	}
	if (trimmed.includes("..")) {
		throw new Error("Agent name cannot include '..'.");
	}
	return trimmed;
}

async function handleConfigSetup(input: {
	configPath: string;
	configRoot: string;
	agentId: string;
	fsRoot: string;
	force: boolean;
	merge: boolean;
	nonInteractive: boolean;
	outputManager: OutputManager;
}): Promise<void> {
	const {
		configPath,
		configRoot,
		agentId,
		fsRoot,
		force,
		merge,
		nonInteractive,
		outputManager,
	} = input;

	const configExists = existsSync(configPath);

	if (configExists && !force && !merge) {
		if (nonInteractive) {
			writeLine(
				outputManager,
				"Config already exists. Use --merge or --force to update it.",
			);
			return;
		}

		const shouldMerge = await promptConfirm(
			"Config exists. Update with recommended settings? (y/N): ",
			false,
		);
		if (!shouldMerge) {
			writeLine(outputManager, "Leaving existing config unchanged.");
			return;
		}
	}

	const nextConfig = configExists && !force
		? mergeConfigFile(configPath, agentId, fsRoot)
		: buildDefaultConfig(agentId, fsRoot);

	if (!nextConfig) {
		writeLine(outputManager, "Config already has recommended settings.");
		return;
	}

	mkdirSync(configRoot, { recursive: true });
	writeFileSync(configPath, JSON.stringify(nextConfig, null, 2));
	writeLine(outputManager, `Saved config to ${configPath}`);
}

function mergeConfigFile(
	configPath: string,
	agentId: string,
	fsRoot: string,
): Record<string, unknown> | null {
	const raw = readFileSync(configPath, "utf-8");
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(
			"Existing wingman.config.json is invalid JSON. Use --force to overwrite.",
		);
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(
			"Existing wingman.config.json is not a JSON object. Use --force to overwrite.",
		);
	}

	const { config, changed } = mergeConfigValues(
		parsed as Record<string, unknown>,
		agentId,
		fsRoot,
	);
	return changed ? config : null;
}

function mergeConfigValues(
	config: Record<string, unknown>,
	agentId: string,
	fsRoot: string,
): { config: Record<string, unknown>; changed: boolean } {
	let changed = false;
	const nextConfig = { ...config };

	if (!nextConfig.defaultAgent) {
		nextConfig.defaultAgent = agentId;
		changed = true;
	}

	const gatewayRaw = nextConfig.gateway;
	const gateway =
		gatewayRaw && typeof gatewayRaw === "object" && !Array.isArray(gatewayRaw)
			? { ...(gatewayRaw as Record<string, unknown>) }
			: {};

	const fsRootsRaw = (gateway as Record<string, unknown>).fsRoots;
	const fsRoots = Array.isArray(fsRootsRaw) ? [...fsRootsRaw] : [];

	if (fsRoot && !fsRoots.includes(fsRoot)) {
		fsRoots.push(fsRoot);
		changed = true;
	}

	if (changed) {
		(nextConfig as Record<string, unknown>).gateway = {
			...gateway,
			fsRoots,
		};
	}

	return { config: nextConfig, changed };
}

function buildDefaultConfig(
	agentId: string,
	fsRoot: string,
): Record<string, unknown> {
	const config = WingmanConfigSchema.parse({});
	config.defaultAgent = agentId;
	config.gateway = {
		...config.gateway,
		fsRoots: [fsRoot],
	};
	return config as unknown as Record<string, unknown>;
}

async function handleAgentSetup(input: {
	configRoot: string;
	agentId: string;
	model?: string;
	force: boolean;
	nonInteractive: boolean;
	outputManager: OutputManager;
	bundledAgentsPath: string | null;
	copyAgents?: string[];
}): Promise<void> {
	const {
		configRoot,
		agentId,
		model,
		force,
		nonInteractive,
		outputManager,
		bundledAgentsPath,
		copyAgents,
	} = input;

	const copiedAgents = bundledAgentsPath
		? copyBundledAgents({
				bundledAgentsPath,
				configRoot,
				force,
				outputManager,
				agentNames: copyAgents,
			})
		: new Set<string>();

	if (copiedAgents.size > 0) {
		writeLine(
			outputManager,
			`Copied ${copiedAgents.size} bundled agent(s) to ${join(
				configRoot,
				"agents",
			)}`,
		);
	}

	const expectedAgentDir = join(configRoot, "agents", agentId);
	const expectedAgentPath = join(expectedAgentDir, "agent.json");
	const expectedAgentExists = existsSync(expectedAgentPath);

	if (!expectedAgentExists) {
		await createFallbackAgent({
			configRoot,
			agentId,
			model,
			force,
			nonInteractive,
			outputManager,
		});
		return;
	}

	if (model) {
		applyModelToAgent(expectedAgentPath, model, outputManager);
	}
}

function resolveBundledAgentsPath(): string | null {
	const candidates = [
		new URL("../../../../.wingman/agents", import.meta.url),
		new URL("../../../.wingman/agents", import.meta.url),
	];

	for (const candidate of candidates) {
		const resolved = fileURLToPath(candidate);
		if (existsSync(resolved) && statSync(resolved).isDirectory()) {
			return resolved;
		}
	}

	const cwdFallback = join(process.cwd(), ".wingman", "agents");
	if (existsSync(cwdFallback) && statSync(cwdFallback).isDirectory()) {
		return cwdFallback;
	}

	return null;
}

function listBundledAgents(bundledAgentsPath: string): string[] {
	return readdirSync(bundledAgentsPath, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name)
		.sort((a, b) => a.localeCompare(b));
}

function copyBundledAgents(input: {
	bundledAgentsPath: string;
	configRoot: string;
	force: boolean;
	outputManager: OutputManager;
	agentNames?: string[];
}): Set<string> {
	const { bundledAgentsPath, configRoot, force, outputManager, agentNames } =
		input;
	const available = listBundledAgents(bundledAgentsPath);
	const entries = agentNames ? agentNames : available;

	const copied = new Set<string>();
	const targetRoot = join(configRoot, "agents");

	for (const entry of entries) {
		const sourceDir = join(bundledAgentsPath, entry);
		const targetDir = join(targetRoot, entry);

		if (existsSync(targetDir) && !force) {
			writeLine(
				outputManager,
				`Agent "${entry}" already exists. Skipping (use --force to overwrite).`,
			);
			continue;
		}

		if (existsSync(targetDir) && force) {
			rmSync(targetDir, { recursive: true, force: true });
		}

		copyDirectory(sourceDir, targetDir);
		copied.add(entry);
	}

	return copied;
}

function copyDirectory(source: string, target: string): void {
	mkdirSync(target, { recursive: true });

	const entries = readdirSync(source, { withFileTypes: true });
	for (const entry of entries) {
		const sourcePath = join(source, entry.name);
		const targetPath = join(target, entry.name);

		if (entry.isDirectory()) {
			copyDirectory(sourcePath, targetPath);
		} else {
			copyFileSync(sourcePath, targetPath);
		}
	}
}

async function createFallbackAgent(input: {
	configRoot: string;
	agentId: string;
	model?: string;
	force: boolean;
	nonInteractive: boolean;
	outputManager: OutputManager;
}): Promise<void> {
	const { configRoot, agentId, model, force, nonInteractive, outputManager } =
		input;

	const agentDir = join(configRoot, "agents", agentId);
	const agentPath = join(agentDir, "agent.json");
	const agentExists = existsSync(agentPath);

	if (agentExists && !force) {
		if (nonInteractive) {
			writeLine(
				outputManager,
				`Agent "${agentId}" already exists. Use --force to overwrite.`,
			);
			return;
		}

		const shouldOverwrite = await promptConfirm(
			`Agent "${agentId}" exists. Overwrite? (y/N): `,
			false,
		);
		if (!shouldOverwrite) {
			writeLine(outputManager, `Keeping existing agent "${agentId}".`);
			return;
		}
	}

	mkdirSync(agentDir, { recursive: true });
	const agentConfig: Record<string, unknown> = {
		name: agentId,
		description: DEFAULT_AGENT_DESCRIPTION,
		systemPrompt: DEFAULT_AGENT_PROMPT,
		tools: DEFAULT_TOOLS,
	};

	if (model) {
		agentConfig.model = model;
	}

	writeFileSync(agentPath, JSON.stringify(agentConfig, null, 2));
	writeLine(outputManager, `Created starter agent at ${agentPath}`);
}

function applyModelToAgent(
	agentPath: string,
	model: string,
	outputManager: OutputManager,
): void {
	try {
		const raw = readFileSync(agentPath, "utf-8");
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		parsed.model = model;
		writeFileSync(agentPath, JSON.stringify(parsed, null, 2));
		writeLine(outputManager, `Updated ${agentPath} with model ${model}`);
	} catch {
		writeLine(
			outputManager,
			`Unable to update model for ${agentPath}. Update manually.`,
		);
	}
}

async function resolveProviderSelection(input: {
	nonInteractive: boolean;
	skipProvider: boolean;
	optionMap: Record<string, unknown>;
	outputManager: OutputManager;
}): Promise<string | undefined> {
	const { nonInteractive, skipProvider, optionMap, outputManager } = input;
	if (skipProvider) {
		return undefined;
	}

	const providerOption = getStringOption(optionMap, ["provider"]);
	if (providerOption) {
		const normalized = normalizeProviderName(providerOption);
		if (!normalized) {
			throw new Error(`Unknown provider: ${providerOption}`);
		}
		return normalized;
	}

	if (nonInteractive) {
		return undefined;
	}

	const providers = listProviderSpecs("model");
	const options = [
		{ value: "__skip__", label: "Skip for now" },
		...providers.map((provider) => ({
			value: provider.name,
			label: provider.label,
			hint: provider.name,
		})),
	];

	const selection = await select({
		message: "Choose a provider to configure",
		options,
	});

	if (isCancel(selection)) {
		abortSetup();
	}

	if (selection === "__skip__") {
		writeLine(outputManager, "Skipping provider configuration.");
		return undefined;
	}

	const normalized = normalizeProviderName(String(selection));
	if (!normalized) {
		throw new Error(`Unknown provider: ${String(selection)}`);
	}
	return normalized;
}

async function resolveModelSelection(input: {
	nonInteractive: boolean;
	optionMap: Record<string, unknown>;
	providerName?: string;
	outputManager: OutputManager;
}): Promise<string | undefined> {
	const { nonInteractive, optionMap, providerName, outputManager } = input;
	const explicitModel = getStringOption(optionMap, ["model"]);
	if (explicitModel) {
		validateModel(explicitModel);
		return explicitModel;
	}

	const providers = listProviderSpecs("model");
	const configuredProvider = providers.find(
		(provider) => resolveProviderToken(provider.name).source !== "missing",
	);
	const suggestedProvider = providerName || configuredProvider?.name;
	const suggestedModel = suggestedProvider
		? DEFAULT_MODELS[suggestedProvider]
		: undefined;

	if (nonInteractive) {
		if (suggestedModel) {
			return suggestedModel;
		}
		return undefined;
	}

	const inputValue = await text({
		message: "Model string (provider:model)",
		placeholder: suggestedModel ? undefined : "anthropic:claude-sonnet-4-5",
		defaultValue: suggestedModel,
	});

	if (isCancel(inputValue)) {
		abortSetup();
	}

	const trimmed = String(inputValue ?? "").trim();

	if (!trimmed && suggestedModel) {
		return suggestedModel;
	}

	if (!trimmed) {
		writeLine(outputManager, "Skipping model selection.");
		return undefined;
	}

	validateModel(trimmed);
	return trimmed;
}

function validateModel(model: string): void {
	const result = ModelFactory.validateModelString(model);
	if (!result.valid) {
		throw new Error(result.error || "Invalid model string.");
	}
}

async function handleProviderSetup(input: {
	providerName?: string;
	optionMap: Record<string, unknown>;
	nonInteractive: boolean;
	outputManager: OutputManager;
}): Promise<void> {
	const { providerName, optionMap, nonInteractive, outputManager } = input;
	if (!providerName) {
		writeLine(outputManager, "No provider selected.");
		return;
	}

	const status = resolveProviderToken(providerName);
	if (status.source !== "missing") {
		writeLine(
			outputManager,
			`Provider "${providerName}" already configured (${status.source}).`,
		);
		return;
	}

	const tokenOption = getTokenOption(optionMap);
	if (tokenOption) {
		saveProviderToken(providerName, tokenOption);
		writeLine(
			outputManager,
			`Saved ${providerName} credentials to ${getCredentialsPath()}`,
		);
		return;
	}

	if (nonInteractive) {
		writeLine(
			outputManager,
			`Missing credentials for "${providerName}". Run "wingman provider login ${providerName}" to add them.`,
		);
		return;
	}

	const tokenInput = await text({
		message: `Enter ${providerName} API key`,
		placeholder: "sk-...",
	});

	if (isCancel(tokenInput)) {
		abortSetup();
	}

	const token = String(tokenInput ?? "").trim();
	if (!token) {
		throw new Error("API key is required.");
	}
	saveProviderToken(providerName, token);
	writeLine(
		outputManager,
		`Saved ${providerName} credentials to ${getCredentialsPath()}`,
	);
}

function getTokenOption(options: Record<string, unknown>): string | undefined {
	const raw =
		getStringOption(options, ["token"]) ??
		getStringOption(options, ["api-key"]) ??
		getStringOption(options, ["apiKey"]);

	if (typeof raw === "string" && raw.trim()) {
		return raw.trim();
	}
	return undefined;
}

function getStringOption(
	options: Record<string, unknown>,
	keys: string[],
): string | undefined {
	for (const key of keys) {
		const raw = options[key];
		if (typeof raw === "string" && raw.trim()) {
			return raw.trim();
		}
	}
	return undefined;
}

function parseAgentList(
	raw: string,
	bundledAgents: string[],
): string[] {
	const normalized = raw
		.split(/[,\s]+/)
		.map((value) => value.trim())
		.filter(Boolean);

	if (normalized.length === 0) {
		return [];
	}

	const unknown = normalized.filter(
		(value) => !bundledAgents.includes(value),
	);
	if (unknown.length > 0) {
		throw new Error(
			`Unknown bundled agents: ${unknown.join(", ")}.`,
		);
	}

	return Array.from(new Set(normalized));
}

function ensureIncludesDefault(
	agents: string[],
	defaultAgent: string,
	bundledAgents: string[],
): string[] {
	if (!bundledAgents.includes(defaultAgent)) {
		return agents;
	}
	if (agents.includes(defaultAgent)) {
		return agents;
	}
	return [...agents, defaultAgent];
}

async function promptForDefaultAgent(
	agents: string[],
	currentDefault: string,
): Promise<string> {
	const choices = agents.length > 0 ? agents : [currentDefault];
	const defaultValue = choices.includes(currentDefault)
		? currentDefault
		: choices[0];

	const selection = await select({
		message: "Pick a default agent",
		options: [
			...choices.map((agent) => ({ value: agent, label: agent })),
			{ value: "__custom__", label: "Custom agent name" },
		],
		initialValue: defaultValue,
	});

	if (isCancel(selection)) {
		abortSetup();
	}

	if (selection === "__custom__") {
		const input = await text({
			message: "Default agent name",
			placeholder: defaultValue,
		});
		if (isCancel(input)) {
			abortSetup();
		}
		const trimmed = String(input ?? "").trim();
		if (!trimmed) {
			return defaultValue;
		}
		return sanitizeAgentId(trimmed);
	}

	return sanitizeAgentId(String(selection));
}

async function promptForAgentSelection(
	agents: string[],
	defaultAgent: string,
): Promise<string[]> {
	const selection = await multiselect({
		message: "Choose bundled agents to copy",
		options: agents.map((agent) => ({ value: agent, label: agent })),
		required: false,
		initialValues: agents.includes(defaultAgent) ? [defaultAgent] : [],
	});

	if (isCancel(selection)) {
		abortSetup();
	}

	const values = Array.isArray(selection)
		? selection.map((value) => String(value))
		: [];

	return Array.from(new Set(values));
}

function getBooleanOption(
	options: Record<string, unknown>,
	keys: string[],
	defaultValue: boolean,
): boolean {
	for (const key of keys) {
		const raw = options[key];
		if (typeof raw === "boolean") {
			return raw;
		}
		if (typeof raw === "string") {
			if (raw.toLowerCase() === "true") {
				return true;
			}
			if (raw.toLowerCase() === "false") {
				return false;
			}
		}
	}
	return defaultValue;
}

function shouldUseClack(
	outputManager: OutputManager,
	nonInteractive: boolean,
): boolean {
	return outputManager.getMode() === "interactive" && !nonInteractive;
}

function abortSetup(): never {
	cancel("Setup cancelled.");
	process.exit(0);
}

async function runStep<T>(
	useClack: boolean,
	label: string,
	handler: () => Promise<T>,
): Promise<T> {
	if (!useClack) {
		return handler();
	}

	const active = spinner();
	active.start(label);
	try {
		const result = await handler();
		active.stop(chalk.green("done"));
		return result;
	} catch (error) {
		active.stop(chalk.red("failed"));
		throw error;
	}
}

async function promptConfirm(
	message: string,
	defaultValue: boolean,
): Promise<boolean> {
	const response = await confirm({
		message,
		initialValue: defaultValue,
	});

	if (isCancel(response)) {
		abortSetup();
	}

	return Boolean(response);
}

function showInitHelp(outputManager: OutputManager, outputMode: OutputMode): void {
	if (outputMode === "interactive") {
		console.log(`
Wingman Init - Quickstart onboarding

Usage:
  wingman init [options]
  wingman init <agent-name>

Options:
  --agent <name>         Agent name (default: wingman)
  --agents <list>        Copy only these bundled agents (comma-separated)
  --model <provider:model>
                         Set model for the starter agent
  --provider <name>      Provider to configure (anthropic|openai|openrouter|copilot|xai)
  --token <token>        Save provider token (non-interactive)
  --api-key <key>        Alias for --token
  --fs-root <path>       Add fs root (default: ".")
  --skip-config          Skip wingman.config.json setup
  --skip-agent           Skip starter agent creation
  --skip-provider        Skip provider credential setup
  --merge                Merge recommended settings into existing config
  --force                Overwrite existing config or agent files
  --yes                  Accept defaults without prompts

Examples:
  wingman init
  wingman init coder --model openai:gpt-4o
  wingman init --provider anthropic
  wingman init --provider openai --api-key="sk-..."
`);
	} else {
		outputManager.emitLog("info", "Init help requested");
	}
}

function writeLine(outputManager: OutputManager, message: string): void {
	if (outputManager.getMode() === "interactive") {
		console.log(message);
	} else {
		outputManager.emitLog("info", message);
	}
}
