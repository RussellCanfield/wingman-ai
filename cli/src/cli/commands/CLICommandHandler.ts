import { confirm, isCancel, log, note, spinner, select } from "@clack/prompts";
import chalk from "chalk";
import { getPlanningPrompt } from "../../commands/planning.js";
import { ConversationRetriever } from "../../persistence/conversationManager.js";
import { logError, agentLogger } from "../../utils/logger.js";
import type { CLIState } from "../types/CLITypes.js";
import fs from "node:fs";

export class CLICommandHandler {
	constructor(
		private state: CLIState,
		private processUserInput: (input: string) => Promise<void>,
	) {}

	async handleCommand(input: string): Promise<boolean> {
		if (!input.startsWith("/")) {
			return false;
		}

		const [command, ...args] = input.split(" ");
		const commandLower = command.toLowerCase();

		switch (commandLower) {
			case "/help":
				this.showHelp();
				return true;
			
			case "/file":
				this.addFileContext(args);
				return true;

			case "/dir":
				this.addDirContext(args);
				return true;

			case "/init":
				await this.initProject();
				return true;

			case "/hotkeys":
				this.showHotkeys();
				return true;

			case "/resume":
				await this.resumeConversation();
				return true;

			case "/compact":
				await this.compactMessages();
				return true;

			case "/clear":
				this.clearContext();
				return true;

			case "/status":
				this.showStatus();
				return true;

			default:
				log.warn(`Unknown command: ${commandLower}`);
				log.info("Type /help to see available commands");
				return true;
		}
	}

	private addFileContext(files: string[]) {
		if (files.length === 0) {
			log.warn("Please provide at least one file path.");
			return;
		}

		const addedFiles: string[] = [];
		for (const file of files) {
			try {
				if (fs.existsSync(file)) {
					if (!this.state.contextFiles.includes(file)) {
						this.state.contextFiles.push(file);
						addedFiles.push(file);
					} else {
						log.warn(`File '${file}' is already in the context.`);
					}
				} else {
					log.error(`File not found: ${file}`);
				}
			} catch (error) {
				log.error(`Error accessing file '${file}': ${(error as Error).message}`);
			}
		}

		if (addedFiles.length > 0) {
			agentLogger.debug({
				event: 'context_files_added',
				files: addedFiles
			}, `Adding ${addedFiles.length} context files`);
			log.success(`Added to context: ${addedFiles.join(", ")}`);
		}
	}

	private addDirContext(dirs: string[]) {
		if (dirs.length === 0) {
			log.warn("Please provide at least one directory path.");
			return;
		}

		const addedDirs: string[] = [];
		for (const dir of dirs) {
			try {
				if (fs.existsSync(dir) && fs.lstatSync(dir).isDirectory()) {
					if (!this.state.contextDirectories.includes(dir)) {
						this.state.contextDirectories.push(dir);
						addedDirs.push(dir);
					} else {
						log.warn(`Directory '${dir}' is already in the context.`);
					}
				} else {
					log.error(`Directory not found or is not a directory: ${dir}`);
				}
			} catch (error) {
				log.error(`Error accessing directory '${dir}': ${(error as Error).message}`);
			}
		}

		if (addedDirs.length > 0) {
			agentLogger.debug({
				event: 'context_directories_added',
				directories: addedDirs
			}, `Adding ${addedDirs.length} context directories`);
			log.success(`Added to context: ${addedDirs.join(", ")}`);
		}
	}

	private async initProject() {
		const s = spinner();
		s.start("Preparing project analysis prompt...");

		try {
			// Get the planning prompt
			const planningPrompt = getPlanningPrompt();

			s.stop(chalk.green("Analysis prompt ready!"));

			// Show info about what this will do
			note(
				// biome-ignore lint/style/useTemplate: <explanation>
				`${chalk.bold("Project Analysis Initialization")}\\n\\n` +
					"This will provide you with a comprehensive prompt to help analyze and understand your codebase.\\n" +
					"The analysis will:\\n\\n" +
					`• ${chalk.cyan("Read your README and configuration files")}\\n` +
					`• ${chalk.cyan("Map your project structure")}\\n` +
					`• ${chalk.cyan("Identify key technologies and dependencies")}\\n` +
					`• ${chalk.cyan("Analyze core business logic and features")}\\n` +
					`• ${chalk.cyan("Generate a detailed project report")}\\n\\n` +
					`${chalk.yellow("Note:")} This will use tools to read multiple files in your project.`,
				"About to start project analysis",
			);

			const shouldProceed = await confirm({
				message: "Would you like to proceed with the project analysis?",
				initialValue: true,
			});

			if (isCancel(shouldProceed) || !shouldProceed) {
				log.info("Project analysis cancelled");
				return;
			}

			// Process the planning prompt as a regular message
			await this.processUserInput(planningPrompt);
		} catch (error) {
			s.stop(chalk.red("Failed to prepare analysis prompt"));
			logError("WingmanCLI", error as Error, { event: "init_project_error" });
			log.error(
				`Failed to initialize project analysis: ${(error as Error).message}`,
			);
		}
	}

	private showHelp() {
		note(
			// biome-ignore lint/style/useTemplate: <explanation>
			`${chalk.bold("Available Commands:")}\\n\\n` +
				`${chalk.cyan("/help")} - Show this help message\\n` +
				`${chalk.cyan("/file <path>")} - Add a file to the context\\n` +
				`${chalk.cyan("/dir <path>")} - Add a directory to the context\\n` +
				`${chalk.cyan("/init")} - Get a comprehensive project analysis prompt\\n` +
				`${chalk.cyan("/hotkeys")} - Show keyboard shortcuts\\n` +
				`${chalk.cyan("/resume")} - Resume a previous conversation\\n` +
				`${chalk.cyan("/compact")} - Compact message history to save tokens\\n` +
				`${chalk.cyan("/clear")} - Clear context files and directories\\n` +
				`${chalk.cyan("/status")} - Show current session status\\n` +
				`${chalk.cyan("/exit")} or ${chalk.cyan("/quit")} - Exit Wingman\\n\\n` +
				`${chalk.bold("Tips:")}\\n` +
				`• Use ${chalk.cyan("Ctrl+C")} to exit at any time\\n` +
				"• Wingman remembers your conversation history\\n" +
				"• You can reference files and directories in your messages\\n" +
				`• Use ${chalk.cyan("/init")} to get started with analyzing a new project`,
			"Wingman Help",
		);
	}

	private showHotkeys() {
		note(
			`${chalk.bold("Keyboard Shortcuts:")}\\n\\n` +
				`${chalk.cyan("Ctrl+C")} - Exit Wingman\\n` +
				`${chalk.cyan("Enter")} - Send message\\n` +
				`${chalk.cyan("↑/↓")} - Navigate command history (if supported)\\n\\n` +
				`${chalk.bold("Command Shortcuts:")}\\n` +
				`${chalk.cyan("/h")} - Same as /help\\n` +
				`${chalk.cyan("/q")} - Same as /quit\\n` +
				`${chalk.cyan("/r")} - Same as /resume`,
			"Keyboard Shortcuts",
		);
	}

	private async resumeConversation() {
		const s = spinner();
		s.start("Loading conversations...");

		try {
			const conversations = await ConversationRetriever.getAllConversations();
			s.stop("Conversations loaded");

			if (conversations.length === 0) {
				log.info("No previous conversations found");
				return;
			}

			const options = conversations.map((conv, index) => ({
				value: index,
				label: `${conv.title || "Untitled"} (${conv.messages.length} messages)`,
				hint: conv.createdAt
					? new Date(conv.createdAt).toLocaleDateString()
					: "",
			}));

			const selected = await select({
				message: "Select a conversation to resume:",
				options: [
					...options,
					{ value: -1, label: "Cancel", hint: "Go back to chat" },
				],
			});

			if (isCancel(selected) || selected === -1) {
				return;
			}

			const conversation = conversations[selected as number];
			this.state.messages = conversation.messages;
			this.state.threadId = conversation.id;

			log.success(`Resumed conversation: ${conversation.title || "Untitled"}`);

			// Show last few messages for context
			const lastMessages = this.state.messages.slice(-3);
			if (lastMessages.length > 0) {
				note(
					lastMessages
						.map(
							(msg) =>
								`${msg.type === "human" ? "👤" : "🤖"} ${msg.content.substring(0, 100)}${msg.content.length > 100 ? "..." : ""}`,
						)
						.join("\\n"),
					"Recent messages:",
				);
			}
		} catch (error) {
			s.stop("Failed to load conversations");
			logError("WingmanCLI", error as Error, {
				event: "resume_conversation_error",
			});
			log.error(`Failed to load conversations: ${(error as Error).message}`);
		}
	}

	private async compactMessages() {
		if (!this.state.agent) {
			log.error("Agent not initialized");
			return;
		}

		if (this.state.messages.length < 5) {
			log.info("Not enough messages to compact");
			return;
		}

		const shouldCompact = await confirm({
			message: `Compact ${this.state.messages.length} messages to save tokens?`,
			initialValue: true,
		});

		if (isCancel(shouldCompact) || !shouldCompact) {
			return;
		}

		const s = spinner();
		s.start("Compacting messages...");

		try {
			await this.state.agent.compactMessages(this.state.threadId);
			s.stop(chalk.green("Messages compacted successfully"));
			log.success("Message history has been compacted to save tokens");
		} catch (error) {
			s.stop(chalk.red("Failed to compact messages"));
			logError("WingmanCLI", error as Error, {
				event: "compact_messages_error",
			});
			log.error(`Failed to compact messages: ${(error as Error).message}`);
		}
	}

	private clearContext() {
		this.state.contextFiles = [];
		this.state.contextDirectories = [];
		log.success("Context files and directories cleared");
	}

	private showStatus() {
		const status = [
			`Model: ${chalk.cyan(this.state.model)}`,
			`Thread ID: ${chalk.gray(this.state.threadId)}`,
			`Messages: ${chalk.cyan(this.state.messages.length)}`,
			`Context Files: ${chalk.cyan(this.state.contextFiles.length)}`,
			`Context Directories: ${chalk.cyan(this.state.contextDirectories.length)}`,
			`Input Tokens: ${chalk.cyan(this.state.inputTokens.toLocaleString())}`,
			`Output Tokens: ${chalk.cyan(this.state.outputTokens.toLocaleString())}`,
			`Total Tokens: ${chalk.cyan((this.state.inputTokens + this.state.outputTokens).toLocaleString())}`,
		].join("\\n");

		note(status, "Session Status");
	}
}
