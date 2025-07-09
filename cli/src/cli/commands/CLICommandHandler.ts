import {
	confirm,
	isCancel,
	log,
	note,
	spinner,
	select,
	text,
} from "@clack/prompts";
import chalk from "chalk";
import { getPlanningPrompt } from "../../commands/planning.js";
import { StateManager } from "../../persistence/stateManager.js";
import { logError, agentLogger } from "../../utils/logger.js";
import type { CLIState } from "../types/CLITypes.js";
import type { WingmanRequest } from "@wingman-ai/agent";
import { getGraphState } from "src/persistence/graphManager.js";

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

			// Task management commands
			case "/tasks":
				await this.showTasks();
				return true;

			case "/task":
				await this.handleTaskCommand(args);
				return true;

			case "/background":
			case "/bg":
				await this.startBackgroundTask(args);
				return true;

			default:
				log.warn(`Unknown command: ${commandLower}`);
				log.info("Type /help to see available commands");
				return true;
		}
	}

	private async showTasks(): Promise<void> {
		if (!this.state.taskManager) {
			log.warn("Task manager or agent not initialized");
			return;
		}

		await this.state.taskManager.showTaskDashboard();
	}

	private async handleTaskCommand(args: string[]): Promise<void> {
		if (!this.state.taskManager) {
			log.warn("Task manager not initialized");
			return;
		}
		await this.state.taskManager.showTaskDashboard();
	}

	private async startBackgroundTask(args: string[]): Promise<void> {
		if (!this.state.taskManager || !this.state.agent) {
			log.warn("Task manager or agent not initialized");
			return;
		}

		if (args.length === 0) {
			log.warn("Please provide a prompt for the background task");
			log.info("Usage: /bg <prompt> or /background <prompt>");
			return;
		}

		const prompt = args.join(" ");

		// Ask for task name
		const taskName = await text({
			message: "Enter a name for this background task:",
			placeholder: "e.g., 'Code analysis', 'Documentation review'",
			defaultValue: `Background: ${prompt.substring(0, 30)}...`,
			validate: (value) => {
				if (!value || value.trim().length === 0) {
					return "Please enter a task name";
				}
			},
		});

		if (isCancel(taskName)) {
			return;
		}

		// Ask for task options
		const cancellable = await confirm({
			message: "Should this task be cancellable?",
			initialValue: true,
		});

		if (isCancel(cancellable)) {
			return;
		}

		const pausable = await confirm({
			message: "Should this task be pausable?",
			initialValue: false,
		});

		if (isCancel(pausable)) {
			return;
		}

		// Create the request
		const request: WingmanRequest = {
			input: prompt,
			threadId: this.state.threadId,
			contextFiles:
				this.state.contextFiles.length > 0
					? this.state.contextFiles
					: undefined,
			contextDirectories:
				this.state.contextDirectories.length > 0
					? this.state.contextDirectories
					: undefined,
		};

		// Start the background task
		const taskId = await this.state.taskManager.startTask(
			taskName.trim(),
			request,
			{
				description: `Background execution of: ${prompt}`,
				cancellable,
				pausable,
			},
		);

		log.success(`Started background task: ${chalk.cyan(taskName.trim())}`);
		log.info(`Task ID: ${chalk.gray(taskId)}`);
		log.info("Use /tasks to monitor progress or /task <id> for details");
	}

	private addFileContext(files: string[]) {
		if (files.length === 0) {
			log.warn("Please provide a file path.");
			return;
		}

		const file = files[0];
		this.state.contextFiles.push(file);

		agentLogger.debug(
			{
				event: "context_files_added",
				files: [file],
			},
			`Adding context file: ${file}`,
		);
		log.success(`Added to context: ${file}`);
	}

	private addDirContext(dirs: string[]) {
		if (dirs.length === 0) {
			log.warn("Please provide a directory path.");
			return;
		}

		const dir = dirs[0];
		this.state.contextDirectories.push(dir);

		agentLogger.debug(
			{
				event: "context_directories_added",
				directories: [dir],
			},
			`Adding context directory: ${dir}`,
		);
		log.success(`Added to context: ${dir}`);
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

			// Ask if they want to run this in the background
			const runInBackground = await confirm({
				message: "Would you like to run this analysis in the background?",
				initialValue: false,
			});

			if (isCancel(runInBackground)) {
				log.info("Project analysis cancelled");
				return;
			}

			if (runInBackground && this.state.taskManager && this.state.agent) {
				// Run as background task
				const request: WingmanRequest = {
					input: planningPrompt,
					threadId: this.state.threadId,
					contextFiles:
						this.state.contextFiles.length > 0
							? this.state.contextFiles
							: undefined,
					contextDirectories:
						this.state.contextDirectories.length > 0
							? this.state.contextDirectories
							: undefined,
				};

				const taskId = await this.state.taskManager.startTask(
					"Project Analysis",
					request,
					{
						description: "Comprehensive project analysis and report generation",
						cancellable: true,
						pausable: false,
					},
				);

				log.success("Started project analysis in the background");
				log.info(`Task ID: ${chalk.gray(taskId)}`);
				log.info("Use /tasks to monitor progress");
			} else {
				// Process the planning prompt as a regular message
				await this.processUserInput(planningPrompt);
			}
		} catch (error) {
			s.stop(chalk.red("Failed to prepare analysis prompt"));
			logError("WingmanCLI", error as Error, { event: "init_project_error" });
			log.error(
				`Failed to initialize project analysis: ${(error as Error).message}`,
			);
		}
	}

	private showHelp() {
		const helpText = `
${chalk.bold("Available Commands:")}

  ${chalk.cyan("/help")} - Show this help message
  ${chalk.cyan("/file <path>")} - Add a file to the context
  ${chalk.cyan("/dir <path>")} - Add a directory to the context
  ${chalk.cyan("/init")} - Get a comprehensive project analysis prompt
  ${chalk.cyan("/hotkeys")} - Show keyboard shortcuts
  ${chalk.cyan("/resume")} - Resume a previous conversation
  ${chalk.cyan("/compact")} - Compact message history to save tokens
  ${chalk.cyan("/clear")} - Clear context files and directories
  ${chalk.cyan("/status")} - Show current session status
  ${chalk.cyan("/exit")} or ${chalk.cyan("/quit")} - Exit Wingman

${chalk.bold("Background Task Commands:")}

  ${chalk.cyan("/tasks")} - Show all background tasks
  ${chalk.cyan("/bg <prompt>")} - Start a new background task
  ${chalk.cyan("/task cancel <id>")} - Cancel a specific task
  ${chalk.cyan("/task pause <id>")} - Pause a specific task
  ${chalk.cyan("/task resume <id>")} - Resume a paused task

${chalk.bold("Tips:")}

  • Use ${chalk.cyan("Ctrl+C")} to exit at any time
  • Wingman remembers your conversation history
  • You can reference files and directories in your messages
  • Use ${chalk.cyan("/init")} to get started with analyzing a new project
  • Background tasks let you continue chatting while long operations run
`;
		note(helpText.trim(), "Wingman Help");
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
				`${chalk.cyan("/r")} - Same as /resume\\n` +
				`${chalk.cyan("/t")} - Same as /tasks\\n` +
				`${chalk.cyan("/bg")} - Same as /background`,
			"Keyboard Shortcuts",
		);
	}

	private async resumeConversation() {
		const s = spinner();
		s.start("Loading conversations...");

		try {
			const conversations = await StateManager.getAllConversations();
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
		const taskSummary = this.state.taskManager?.getTasksStatusSummary() || "";

		const status = [
			`Model: ${chalk.cyan(this.state.model)}`,
			`Thread ID: ${chalk.gray(this.state.threadId)}`,
			`Messages: ${chalk.cyan(this.state.messages.length)}`,
			`Context Files: ${chalk.cyan(this.state.contextFiles.length)}`,
			`Context Directories: ${chalk.cyan(this.state.contextDirectories.length)}`,
			`Input Tokens: ${chalk.cyan(this.state.inputTokens.toLocaleString())}`,
			`Output Tokens: ${chalk.cyan(this.state.outputTokens.toLocaleString())}`,
			`Total Tokens: ${chalk.cyan((this.state.inputTokens + this.state.outputTokens).toLocaleString())}`,
			taskSummary ? `Background Tasks: ${chalk.cyan(taskSummary)}` : "",
		]
			.filter(Boolean)
			.join("\\n");

		note(status, "Session Status");
	}
}
