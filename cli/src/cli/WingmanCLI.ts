import { intro, outro, text, confirm, isCancel, log } from "@clack/prompts";
import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";
import type { WingmanRequest } from "@wingman-ai/agent";
import { agentLogger, logError, logPerformance } from "../utils/logger.js";
import { CLIInitializer } from "./initialization/CLIInitializer.js";
import { CLICommandHandler } from "./commands/CLICommandHandler.js";
import { MessageStreamer } from "./streaming/MessageStreamer.js";
import { TaskManager } from "./tasks/TaskManager.js";
import type { CLIState } from "./types/CLITypes.js";

export class WingmanCLI {
	private state: CLIState = {
		agent: null,
		threadId: uuidv4(),
		messages: [],
		contextFiles: [],
		contextDirectories: [],
		inputTokens: 0,
		outputTokens: 0,
		model: "",
	};

	private commandHandler!: CLICommandHandler;
	private messageStreamer!: MessageStreamer;

	async run(initialPrompt?: string) {
		// Show beautiful intro
		intro(chalk.cyan("🤖 Wingman AI"));

		// Initialize the agent
		const initialized = await this.initialize();
		if (!initialized) {
			return;
		}

		// Setup handlers
		this.setupHandlers();

		// Handle initial prompt if provided
		if (initialPrompt) {
			await this.processUserInput(initialPrompt);
		}

		// Start the main chat loop
		await this.startChatLoop();
	}

	private async initialize(): Promise<boolean> {
		const initializer = new CLIInitializer();
		const result = await initializer.initialize();

		if (!result) {
			return false;
		}

		this.state.agent = result.agent;
		this.state.model = result.model;

		// Initialize task manager
		if (this.state.agent) {
			this.state.taskManager = new TaskManager(this.state.agent);

			// Set up task event handlers for notifications
			this.setupTaskEventHandlers();
		}

		return true;
	}

	private setupTaskEventHandlers() {
		if (!this.state.taskManager) return;

		this.state.taskManager.on("taskCompleted", (task) => {
			// Show a subtle notification that doesn't interrupt the chat flow
			console.log(); // Add some spacing
			log.success(`🎉 Background task completed: "${task.name}"`);
			if (task.result) {
				log.info(`   Use ${chalk.cyan("/tasks")} to view results`);
			}
			console.log(); // Add some spacing
		});

		this.state.taskManager.on("taskFailed", (task, error) => {
			console.log(); // Add some spacing
			log.error(`❌ Background task failed: "${task.name}"`);
			log.info(`   Error: ${error}`);
			log.info(`   Use ${chalk.cyan("/tasks")} to view details`);
			console.log(); // Add some spacing
		});

		this.state.taskManager.on("taskCancelled", (task) => {
			console.log(); // Add some spacing
			log.warn(`🛑 Background task cancelled: "${task.name}"`);
			console.log(); // Add some spacing
		});
	}

	private setupHandlers() {
		this.commandHandler = new CLICommandHandler(
			this.state,
			this.processUserInput.bind(this),
		);

		if (this.state.agent) {
			this.messageStreamer = new MessageStreamer(this.state.agent, this.state);
		}
	}

	private async startChatLoop() {
		while (true) {
			try {
				// Show task status in prompt if there are background tasks
				const taskStatus =
					this.state.taskManager?.getTasksStatusSummary() || "";
				const promptMessage = taskStatus
					? `What can I help you with? ${chalk.gray(taskStatus)}`
					: "What can I help you with?";

				const userInput = await text({
					message: chalk.bold(promptMessage),
					placeholder: "Ask me anything... (or type /help for commands)",
					validate: (value) => {
						if (!value || value.trim().length === 0) {
							return "Please enter a message";
						}
					},
				});

				// Handle cancellation (Ctrl+C)
				if (isCancel(userInput)) {
					await this.handleExit();
					break;
				}

				const input = userInput.trim();

				// Handle exit commands
				if (input === "/exit" || input === "/quit") {
					await this.handleExit();
					break;
				}

				// Process the user input
				await this.processUserInput(input);
			} catch (error) {
				logError("WingmanCLI", error as Error, {
					event: "chat_loop_error",
				});

				log.error(`Error in chat loop: ${(error as Error).message}`);

				const shouldContinue = await confirm({
					message: "Would you like to continue?",
					initialValue: true,
				});

				if (isCancel(shouldContinue) || !shouldContinue) {
					await this.handleExit();
					break;
				}
			}
		}
	}

	private async handleExit() {
		// Check if there are running background tasks
		const runningTasks = this.state.taskManager?.getRunningTasksCount() || 0;

		if (runningTasks > 0) {
			const shouldExit = await confirm({
				message: `You have ${runningTasks} background task(s) running. Exit anyway?`,
				initialValue: false,
			});

			if (isCancel(shouldExit) || !shouldExit) {
				log.info("Exit cancelled. Use /tasks to manage background tasks.");
				return;
			}
		}

		// Clean up task manager
		if (this.state.taskManager) {
			this.state.taskManager.cleanup();
		}

		outro(chalk.cyan("Thanks for using Wingman! 👋"));
	}

	private async processUserInput(input: string) {
		const submitStartTime = Date.now();

		agentLogger.info(
			{
				event: "submit_start",
				inputLength: input.length,
				hasContextFiles: this.state.contextFiles.length > 0,
				hasContextDirectories: this.state.contextDirectories.length > 0,
				contextFilesCount: this.state.contextFiles.length,
				contextDirectoriesCount: this.state.contextDirectories.length,
			},
			"Starting request submission",
		);

		try {
			// Check if it's a command
			const commandHandled = await this.commandHandler.handleCommand(input);
			if (commandHandled) {
				logPerformance(
					"WingmanCLI",
					"command_handling",
					Date.now() - submitStartTime,
					{
						command: input,
						handled: true,
					},
				);
				return;
			}

			if (!this.state.agent) {
				log.error("Agent not initialized");
				return;
			}

			// Show user message
			log.message(chalk.blue("You: ") + input);

			// Add to message history
			const humanMessage = {
				id: uuidv4(),
				type: "human" as const,
				content: input,
				timestamp: new Date(),
			};
			this.state.messages.push(humanMessage);

			// Create request
			const request: WingmanRequest = {
				input,
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

			agentLogger.info(
				{
					event: "agent_stream_start",
					threadId: this.state.threadId,
					finalInputLength: input.length,
					fullRequest: request,
				},
				"Starting agent stream",
			);

			// Start streaming response
			await this.messageStreamer.streamResponse(request);

			const totalDuration = Date.now() - submitStartTime;
			logPerformance("WingmanCLI", "total_submit", totalDuration, {
				inputLength: input.length,
			});
		} catch (error) {
			logError("WingmanCLI", error as Error, {
				event: "submit_error",
				originalInput: input,
				threadId: this.state.threadId,
				hasAgent: !!this.state.agent,
			});

			log.error(`Error processing request: ${(error as Error).message}`);
		}
	}
}
