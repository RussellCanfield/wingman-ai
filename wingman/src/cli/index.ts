#!/usr/bin/env node

import type { LogLevel } from "../logger.js";
import type { OutputMode, AgentCommandArgs } from "./types.js";
import type { SkillCommandArgs } from "./types/skill.js";
import { WingmanConfigLoader } from "./config/loader.js";
import { OutputManager } from "./core/outputManager.js";
import { executeAgentCommand } from "./commands/agent.js";
import { executeSkillCommand } from "./commands/skill.js";

/**
 * Parse command line arguments
 */
function parseArgs(argv: string[]): {
	command: string;
	subcommand: string;
	subcommandArgs: string[];
	agent?: string;
	verbosity?: string;
	help: boolean;
	prompt: string;
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
		help: false,
		prompt: "",
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
		} else if (arg.startsWith("-v")) {
			// Count 'v's for verbosity level
			const vCount = arg.split("").filter((c) => c === "v").length;
			parsed.verbosity = vCount >= 2 ? "debug" : "info";
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
  wingman skill <subcommand> [args]

Commands:
  agent                        Invoke a specific agent directly
  skill browse                 Browse available skills from repository
  skill install <name>         Install a skill
  skill list                   List installed skills
  skill remove <name>          Remove an installed skill

Options:
  --agent <name>      Agent name to invoke (required for agent command)
  -v, -vv             Verbosity level (v=info, vv=debug)
  --verbose=<level>   Set log level (debug|info|warn|error|silent)
  -h, --help          Show this help message

Examples:
  wingman agent --agent researcher "what is quantum computing"
  wingman agent --agent coder -vv "add a login function"
  wingman skill browse
  wingman skill install pdf
  wingman skill list

Available agents:
  Run "wingman agent" without a prompt to list all available agents.
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

		// Determine output mode
		let outputMode: OutputMode;
		if (config.cli.outputMode === "auto") {
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

			await executeAgentCommand(commandArgs);
		} else if (parsed.command === "skill") {
			const commandArgs: SkillCommandArgs = {
				subcommand: parsed.subcommand,
				args: parsed.subcommandArgs,
				verbosity,
				outputMode,
			};

			await executeSkillCommand(commandArgs);
		} else {
			console.error(`Unknown command: ${parsed.command}`);
			console.error('Run "wingman --help" for usage information');
			process.exit(1);
		}
	} catch (error) {
		console.error(
			`Fatal error: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}

// Run the CLI
main();
