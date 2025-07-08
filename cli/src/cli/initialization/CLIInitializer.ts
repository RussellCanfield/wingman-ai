import { spinner, note, cancel } from "@clack/prompts";
import chalk from "chalk";
import fs from "node:fs";
import { WingmanAgent } from "@wingman-ai/agent";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { loadConfig, createModel } from "../../config/index.js";
import { getWingmanInstructions } from "../../config.js";
import { agentLogger, logError, logPerformance } from "../../utils/logger.js";

export interface InitializationResult {
	agent: WingmanAgent;
	model: string;
}

export class CLIInitializer {
	async initialize(): Promise<InitializationResult | null> {
		const s = spinner();
		s.start("Initializing Wingman agent...");

		const initStartTime = Date.now();
		agentLogger.info(
			{ event: "agent_init_start" },
			"Starting agent initialization",
		);

		try {
			const config = loadConfig();
			const model = createModel(config);

			agentLogger.debug(
				{
					event: "config_loaded",
					model: config.model,
				},
				`Configuration loaded with model: ${config.model}`,
			);

			if (!fs.existsSync("./.wingman")) {
				fs.mkdirSync("./.wingman", { recursive: true });
				agentLogger.debug(
					{ event: "wingman_dir_created" },
					"Created .wingman directory",
				);
			}

			const wingmanAgent = new WingmanAgent({
				name: "Wingman CLI Agent",
				//@ts-expect-error
				model,
				instructions: getWingmanInstructions(process.cwd()),
				mode: "vibe",
				memory: SqliteSaver.fromConnString("./.wingman/memory.db"),
				toolAbilities: {
					blockedCommands: config.toolAbilities?.blockedCommands,
					allowScriptExecution:
						config.toolAbilities?.allowScriptExecution ?? true,
				},
			});

			agentLogger.debug(
				{ event: "agent_created" },
				"WingmanAgent instance created",
			);

			await wingmanAgent.initialize();

			const initDuration = Date.now() - initStartTime;
			logPerformance("WingmanCLI", "agent_initialization", initDuration);

			s.stop(chalk.green("Agent ready! 🚀"));

			agentLogger.info(
				{
					event: "agent_init_complete",
					duration: initDuration,
				},
				`Agent initialized successfully in ${initDuration}ms`,
			);

			// Show helpful info
			this.showWelcomeMessage(config.model);

			return {
				agent: wingmanAgent,
				model: config.model,
			};
		} catch (error) {
			const initDuration = Date.now() - initStartTime;
			s.stop(chalk.red("Failed to initialize agent"));

			logError("WingmanCLI", error as Error, {
				event: "agent_init_error",
				duration: initDuration,
			});

			cancel(`Error: ${(error as Error).message}`);
			return null;
		}
	}

	private showWelcomeMessage(model: string) {
		note(
			`Model: ${chalk.cyan(model)}\n` +
				`Working Directory: ${chalk.gray(process.cwd())}\n` +
				`Memory: ${chalk.gray("./.wingman/memory.db")}\n\n` +
				`${chalk.bold("Available Commands:")}\n` +
				`• ${chalk.cyan("/help")} - Show available commands\n` +
				`• ${chalk.cyan("/init")} - Get a comprehensive project analysis\n` +
				`• ${chalk.cyan("/file <path>")} - Add a file to the context\n` +
				`• ${chalk.cyan("/dir <path>")} - Add a directory to the context\n` +
				`• ${chalk.cyan("/tasks")} - Show background tasks\n` +
				`• ${chalk.cyan("/hotkeys")} - Show keyboard shortcuts\n` +
				`• ${chalk.cyan("/resume")} - Resume previous conversation\n` +
				`• ${chalk.cyan("/compact")} - Compact message history\n` +
				`• ${chalk.cyan("/exit")} or ${chalk.cyan("/quit")} - Exit Wingman`,
			"Wingman is ready!",
		);
	}
}
