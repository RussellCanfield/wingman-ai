#!/usr/bin/env node

import { createLogger, getLogFilePath, type LogLevel } from "../logger.js";
import type { OutputMode, AgentCommandArgs } from "./types.js";
import type { SkillCommandArgs } from "./types/skill.js";
import { WingmanConfigLoader } from "./config/loader.js";
import { getGatewayTokenFromEnv } from "@/gateway/env.js";
import { OutputManager } from "./core/outputManager.js";
import { executeAgentCommand } from "./commands/agent.js";
import { executeSkillCommand } from "./commands/skill.js";
import { executeGatewayCommand } from "./commands/gateway.js";
import type { GatewayCommandArgs } from "./commands/gateway.js";
import { executeProviderCommand } from "./commands/provider.js";
import type { ProviderCommandArgs } from "./types/provider.js";
import { executeInitCommand } from "./commands/init.js";
import type { InitCommandArgs } from "./types/init.js";

/**
 * Parse command line arguments
 */
function parseArgs(argv: string[]): {
	command: string;
	subcommand: string;
	subcommandArgs: string[];
	agent?: string;
	verbosity?: string;
	outputMode?: string;
	help: boolean;
	prompt: string;
	commandOptions?: Record<string, unknown>;
} {
	const args = argv.slice(2); // Remove 'node' and script path

	// Check for help flag first
	if (args.includes("--help") || args.includes("-h")) {
		return {
			command: "",
			subcommand: "",
			subcommandArgs: [],
			help: true,
			prompt: "",
		};
	}

	const parsed = {
		command: args[0] || "",
		subcommand: args[1] || "",
		subcommandArgs: args.slice(2),
		agent: undefined as string | undefined,
		verbosity: undefined as string | undefined,
		outputMode: undefined as string | undefined,
		help: false,
		prompt: "",
		commandOptions: {} as Record<string, unknown>,
	};

	const promptParts: string[] = [];

	for (let i = 1; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--agent" && i + 1 < args.length) {
			parsed.agent = args[i + 1];
			i++; // Skip next arg
		} else if (arg.startsWith("--agent=")) {
			parsed.agent = arg.split("=")[1];
		} else if (arg.startsWith("--verbose=")) {
			parsed.verbosity = arg.split("=")[1];
		} else if (arg.startsWith("--output=")) {
			parsed.outputMode = arg.split("=")[1];
		} else if (arg.startsWith("-v")) {
			// Count 'v's for verbosity level
			const vCount = arg.split("").filter((c) => c === "v").length;
			parsed.verbosity = vCount >= 2 ? "debug" : "info";
		} else if (arg.startsWith("--")) {
			// Parse command options
			const [key, value] = arg.slice(2).split("=");
			if (value !== undefined) {
				parsed.commandOptions![key] = value;
			} else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
				parsed.commandOptions![key] = args[i + 1];
				i++;
			} else {
				parsed.commandOptions![key] = true;
			}
		} else {
			// Everything else is part of the prompt
			promptParts.push(arg);
		}
	}

	parsed.prompt = promptParts.join(" ");

	return parsed;
}

/**
 * Determine verbosity level from CLI args and config
 */
function determineVerbosity(
	cliVerbosity: string | undefined,
	configLevel: LogLevel,
): LogLevel {
	if (cliVerbosity) {
		const validLevels: LogLevel[] = [
			"debug",
			"info",
			"warn",
			"error",
			"silent",
		];
		if (validLevels.includes(cliVerbosity as LogLevel)) {
			return cliVerbosity as LogLevel;
		}
	}
	return configLevel;
}

/**
 * Display help message
 */
function showHelp(): void {
	console.log(`
Wingman CLI - AI coding assistant

Usage:
  wingman agent --agent <name> [options] <prompt>
  wingman init [options]
  wingman skill <subcommand> [args]
  wingman provider <subcommand> [options]
  wingman gateway <subcommand> [options]

Commands:
  agent                        Invoke a specific agent directly
  init                         Create a starter config + agent (onboarding)
  skill browse                 Browse available skills from repository
  skill install <name>         Install a skill
  skill list                   List installed skills
  skill remove <name>          Remove an installed skill
  provider login <provider>    Store provider credentials
  provider logout <provider>   Remove stored provider credentials
  provider status              Show provider configuration status
  gateway start                Start the gateway server
  gateway stop                 Stop the gateway server
  gateway status               Show gateway status
  gateway join <url>           Join a gateway as a node

Options:
  --agent <name>      Agent name to invoke (required for agent command)
  --local             Run agent locally instead of via gateway
  --gateway <url>     Gateway URL (default from config)
  --token <token>     Gateway auth token
  --password <value>  Gateway auth password
  --output=<mode>     Output mode (interactive|json), overrides auto-detect
  -v, -vv             Verbosity level (v=info, vv=debug)
  --verbose=<level>   Set log level (debug|info|warn|error|silent)
  -h, --help          Show this help message

Examples:
  wingman agent --agent researcher "what is quantum computing"
  wingman agent --agent coder -vv "add a login function"
  wingman agent --agent coder --local "fix the tests"
  wingman agent --agent coder --gateway ws://localhost:18789/ws --token sk-... "ship it"
  wingman init
  wingman skill browse
  wingman skill install pdf
  wingman skill list
  wingman provider status
  wingman provider login copilot --token="<token>"
  wingman gateway start
  wingman gateway join ws://localhost:3000/ws --name="agent-1"

Available agents:
  Run "wingman agent" without a prompt to list all available agents.
  
For gateway help:
  wingman gateway --help
  `);
}

/**
 * Main CLI entry point
 */
async function main() {
	try {
		const parsed = parseArgs(process.argv);

		// Show help
		if (parsed.help || !parsed.command) {
			showHelp();
			process.exit(0);
		}

		// Load configuration
		const configLoader = new WingmanConfigLoader();
		const config = configLoader.loadConfig();

		// Determine output mode (CLI flag > config > auto-detect)
		let outputMode: OutputMode;
		if (
			parsed.outputMode === "interactive" ||
			parsed.outputMode === "json"
		) {
			outputMode = parsed.outputMode;
		} else if (config.cli.outputMode === "auto") {
			outputMode = OutputManager.detectMode();
		} else {
			outputMode = config.cli.outputMode as OutputMode;
		}

		// Determine verbosity
		const verbosity = determineVerbosity(parsed.verbosity, config.logLevel);

		// Route to command handler
		if (parsed.command === "agent") {
			const commandArgs: AgentCommandArgs = {
				agent: parsed.agent || config.defaultAgent,
				verbosity,
				outputMode,
				prompt: parsed.prompt,
			};

			const gatewayConfig = config.gateway;
			const gatewayUrl =
				(parsed.commandOptions?.gateway as string | undefined) ||
				(parsed.commandOptions?.gatewayUrl as string | undefined) ||
				(gatewayConfig
					? `ws://${gatewayConfig.host}:${gatewayConfig.port}/ws`
					: undefined);
			const token =
				(parsed.commandOptions?.token as string | undefined) ||
				gatewayConfig?.auth?.token ||
				getGatewayTokenFromEnv();
			const password =
				(parsed.commandOptions?.password as string | undefined) ||
				gatewayConfig?.auth?.password;

			await executeAgentCommand(commandArgs, {
				local: Boolean(parsed.commandOptions?.local),
				gatewayUrl,
				token,
				password,
			});
		} else if (parsed.command === "skill") {
			const commandArgs: SkillCommandArgs = {
				subcommand: parsed.subcommand,
				args: parsed.subcommandArgs,
				verbosity,
				outputMode,
			};

			await executeSkillCommand(commandArgs);
		} else if (parsed.command === "gateway") {
			const commandArgs: GatewayCommandArgs = {
				subcommand: parsed.subcommand,
				args: parsed.subcommandArgs,
				options: parsed.commandOptions || {},
			};

			await executeGatewayCommand(commandArgs);
		} else if (parsed.command === "provider") {
			const commandArgs: ProviderCommandArgs = {
				subcommand: parsed.subcommand,
				args: parsed.subcommandArgs,
				verbosity,
				outputMode,
				options: parsed.commandOptions || {},
			};

			await executeProviderCommand(commandArgs);
		} else if (parsed.command === "init" || parsed.command === "onboard") {
			const commandArgs: InitCommandArgs = {
				subcommand: parsed.subcommand,
				args: parsed.subcommandArgs,
				verbosity,
				outputMode,
				options: parsed.commandOptions || {},
				agent: parsed.agent,
			};

			await executeInitCommand(commandArgs);
		} else {
			const logFile = getLogFilePath();
			createLogger(verbosity).error(`Unknown command: ${parsed.command}`);
			console.error(`Unknown command: ${parsed.command}`);
			console.error('Run "wingman --help" for usage information');
			console.error(`Logs: ${logFile}`);
			process.exit(1);
		}
	} catch (error) {
		const logFile = getLogFilePath();
		createLogger().error(
			"Fatal error",
			error instanceof Error ? error.message : String(error),
		);
		console.error(
			`Fatal error: ${error instanceof Error ? error.message : String(error)}`,
		);
		console.error(`Logs: ${logFile}`);
		process.exit(1);
	}
}

// Run the CLI
main();
