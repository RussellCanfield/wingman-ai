import { createInterface } from "node:readline";
import { createLogger, getLogFilePath } from "@/logger.js";
import { resolveCodexAuthFromFile } from "@/providers/codex.js";
import {
	deleteProviderCredentials,
	getCredentialsPath,
	resolveProviderToken,
	saveProviderToken,
	setProviderCredentials,
} from "@/providers/credentials.js";
import { loginWithLocalCallback } from "@/providers/oauth.js";
import { getProviderSpec, listProviderSpecs } from "@/providers/registry.js";
import { OutputManager } from "../core/outputManager.js";
import type { ProviderCommandArgs } from "../types/provider.js";

/**
 * Execute provider command
 */
export async function executeProviderCommand(
	args: ProviderCommandArgs,
): Promise<void> {
	const outputManager = new OutputManager(args.outputMode);

	try {
		switch (args.subcommand) {
			case "login":
				await handleLogin(outputManager, args);
				break;
			case "logout":
				handleLogout(outputManager, args);
				break;
			case "status":
			case "list":
				handleStatus(outputManager);
				break;
			case "":
			case "help":
			case "--help":
			case "-h":
				showProviderHelp(outputManager);
				break;
			default:
				throw new Error(
					`Unknown subcommand: ${args.subcommand}. Run 'wingman provider help' for usage.`,
				);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const logFile = getLogFilePath();
		createLogger().error("Provider command failed", { error: message });

		if (outputManager.getMode() === "interactive") {
			console.error(`\nError: ${message}`);
			console.error(`Logs: ${logFile}`);
			process.exit(1);
		} else {
			outputManager.emitAgentError(error as Error);
			process.exit(1);
		}
	}
}

async function handleLogin(
	outputManager: OutputManager,
	args: ProviderCommandArgs,
): Promise<void> {
	const providerName = args.args[0];
	if (!providerName) {
		throw new Error(
			"Provider name required. Usage: wingman provider login <provider>",
		);
	}

	const provider = getProviderSpec(providerName);
	if (!provider) {
		throw new Error(`Unknown provider: ${providerName}`);
	}

	const token = getTokenOption(args.options);
	if (token) {
		saveProviderToken(provider.name, token);
		writeLine(
			outputManager,
			`Saved ${provider.label} credentials to ${getCredentialsPath()}`,
		);
		return;
	}

	if (provider.name === "codex") {
		const codexAuth = resolveCodexAuthFromFile();
		if (codexAuth.accessToken) {
			writeLine(
				outputManager,
				`Detected Codex login at ${codexAuth.authPath}. Wingman will use it automatically.`,
			);
			return;
		}

		if (outputManager.getMode() !== "interactive") {
			throw new Error(
				`Codex login not found at ${codexAuth.authPath}. Run "codex login" or pass --token.`,
			);
		}

		writeLine(outputManager, `No Codex login found at ${codexAuth.authPath}.`);
		const resolvedToken = await promptForToken(
			`Enter ${provider.label} token: `,
		);
		saveProviderToken(provider.name, resolvedToken);
		writeLine(
			outputManager,
			`Saved ${provider.label} credentials to ${getCredentialsPath()}`,
		);
		return;
	}

	if (provider.type === "oauth") {
		const credentials = await loginWithLocalCallback(provider.name, {
			clientId: getOptionValue(args.options, "client-id"),
			clientSecret: getOptionValue(args.options, "client-secret"),
			scopes: getScopes(args.options),
			redirectPort: getNumberOption(args.options, "redirect-port"),
			openBrowser: getBooleanOption(args.options, "open-browser", true),
			onMessage: (message) => writeLine(outputManager, message),
		});

		setProviderCredentials(provider.name, credentials);
		writeLine(
			outputManager,
			`Saved ${provider.label} credentials to ${getCredentialsPath()}`,
		);
		return;
	}

	if (outputManager.getMode() !== "interactive") {
		throw new Error("API key required in JSON mode. Use --api-key.");
	}

	const tokenLabel = provider.name === "copilot" ? "token" : "API key";
	const resolvedToken = await promptForToken(
		`Enter ${provider.label} ${tokenLabel}: `,
	);
	saveProviderToken(provider.name, resolvedToken);
	writeLine(
		outputManager,
		`Saved ${provider.label} credentials to ${getCredentialsPath()}`,
	);
}

function handleLogout(
	outputManager: OutputManager,
	args: ProviderCommandArgs,
): void {
	const providerName = args.args[0];
	if (!providerName) {
		throw new Error(
			"Provider name required. Usage: wingman provider logout <provider>",
		);
	}

	const provider = getProviderSpec(providerName);
	if (!provider) {
		throw new Error(`Unknown provider: ${providerName}`);
	}

	const removed = deleteProviderCredentials(provider.name);
	if (removed) {
		writeLine(
			outputManager,
			`Removed ${provider.label} credentials from ${getCredentialsPath()}`,
		);
	} else {
		writeLine(outputManager, `No stored credentials for ${provider.label}`);
	}
}

function handleStatus(outputManager: OutputManager): void {
	writeLine(outputManager, "Provider status:");

	for (const provider of listProviderSpecs()) {
		const resolved = resolveProviderToken(provider.name);
		const source =
			resolved.source === "env" ? `env (${resolved.envVar})` : resolved.source;

		writeLine(
			outputManager,
			`  ${provider.name} (${provider.type}) - ${source}`,
		);

		writeLine(outputManager, `    env: ${provider.envVars.join(", ")}`);
	}

	writeLine(outputManager, `Credentials file: ${getCredentialsPath()}`);
}

function showProviderHelp(outputManager: OutputManager): void {
	if (outputManager.getMode() === "interactive") {
		console.log(`
Wingman Provider Manager

Usage:
  wingman provider login <provider> [options]
  wingman provider logout <provider>
  wingman provider status
  wingman provider help

Examples:
  wingman provider status
  wingman provider login copilot
  wingman provider login codex
  wingman provider login openrouter --api-key="<key>"
  wingman provider login lmstudio
  wingman provider login ollama

Options:
  --token <token>          Store a token directly
  --api-key <key>          Store an API key directly

Environment Variables:
  ANTHROPIC_API_KEY     Anthropic API key
  OPENAI_API_KEY        OpenAI API key
  CODEX_ACCESS_TOKEN    OpenAI Codex ChatGPT access token
  CHATGPT_ACCESS_TOKEN  OpenAI Codex ChatGPT access token
  OPENROUTER_API_KEY    OpenRouter API key
  GITHUB_COPILOT_TOKEN  GitHub Copilot token
  COPILOT_TOKEN         GitHub Copilot token
  COPILOT_API_KEY       GitHub Copilot token
  LMSTUDIO_API_KEY      LM Studio API key (optional)
  OLLAMA_API_KEY        Ollama API key (optional)
  ELEVENLABS_API_KEY    ElevenLabs API key
  XI_API_KEY            ElevenLabs API key
`);
	} else {
		outputManager.emitLog("info", "Provider help requested");
	}
}

function getTokenOption(options: Record<string, unknown>): string | undefined {
	const raw =
		getOptionValue(options, "token") ??
		getOptionValue(options, "api-key") ??
		getOptionValue(options, "apiKey");

	if (typeof raw === "string" && raw.trim()) {
		return raw.trim();
	}

	return undefined;
}

function getOptionValue(
	options: Record<string, unknown>,
	key: string,
): string | undefined {
	const raw = options[key] as string | undefined;
	if (typeof raw === "string" && raw.trim()) {
		return raw.trim();
	}
	return undefined;
}

function getScopes(options: Record<string, unknown>): string[] | undefined {
	const raw =
		getOptionValue(options, "scopes") ?? getOptionValue(options, "scope");
	if (!raw) {
		return undefined;
	}

	return raw
		.split(/[,\s]+/)
		.map((scope) => scope.trim())
		.filter(Boolean);
}

function getNumberOption(
	options: Record<string, unknown>,
	key: string,
): number | undefined {
	const value = getOptionValue(options, key);
	if (!value) {
		return undefined;
	}
	const parsed = Number(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function getBooleanOption(
	options: Record<string, unknown>,
	key: string,
	defaultValue: boolean,
): boolean {
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
	return defaultValue;
}

async function promptForToken(prompt: string): Promise<string> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const answer = await new Promise<string>((resolve) => {
		rl.question(prompt, (value) => resolve(value));
	});

	rl.close();

	const trimmed = answer.trim();
	if (!trimmed) {
		throw new Error("Token is required");
	}

	return trimmed;
}

function writeLine(outputManager: OutputManager, message: string): void {
	if (outputManager.getMode() === "interactive") {
		console.log(message);
	} else {
		outputManager.emitLog("info", message);
	}
}
