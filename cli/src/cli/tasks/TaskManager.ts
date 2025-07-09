import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
import chalk from "chalk";
import { log, note, select, confirm, isCancel, spinner } from "@clack/prompts";
import type {
	WingmanAgent,
	WingmanRequest,
	BackgroundAgentStatus,
	BackgroundAgentEventEmitter,
} from "@wingman-ai/agent";
import { agentLogger, logError } from "../../utils/logger.js";
import type { AIMessage } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";

export interface BackgroundTask {
	id: string;
	name: string;
	description?: string;
	status:
		| "running"
		| "completed"
		| "failed"
		| "integrating"
		| "integrated"
		| "conflict";
	progress?: number;
	startTime: Date;
	endTime?: Date;
	estimatedCompletion?: Date;
	output: string[];
	error?: string;
	cancellable: boolean;
	pausable: boolean;
	request?: WingmanRequest;
	result?: any;
	agentThreadId?: string;
}

export interface TaskManagerEvents {
	taskStarted: (task: BackgroundTask) => void;
	taskProgress: (task: BackgroundTask, progress: number) => void;
	taskCompleted: (task: BackgroundTask) => void;
	taskFailed: (task: BackgroundTask, error: string) => void;
	taskCancelled: (task: BackgroundTask) => void;
	taskPaused: (task: BackgroundTask) => void;
	taskResumed: (task: BackgroundTask) => void;
}

export class TaskManager extends EventEmitter {
	private tasks = new Map<string, BackgroundTask>();
	private activeWorkers = new Map<string, AbortController>();
	private agentEvents: BackgroundAgentEventEmitter;

	constructor(private agent: WingmanAgent) {
		super();
		this.agentEvents = this.agent.events;
		this.setupEventHandlers();
	}

	private setupEventHandlers() {
		this.on("taskCompleted", (task) => {
			agentLogger.info(
				{
					event: "background_task_completed",
					taskId: task.id,
					taskName: task.name,
					duration: task.endTime
						? task.endTime.getTime() - task.startTime.getTime()
						: 0,
				},
				`Background task completed: ${task.name}`,
			);
		});

		this.on("taskFailed", (task, error) => {
			agentLogger.error(
				{
					event: "background_task_failed",
					taskId: task.id,
					taskName: task.name,
					error,
				},
				`Background task failed: ${task.name}`,
			);
		});

		// Subscribe to agent events
		this.agentEvents.on("status", this.handleAgentStatusUpdate.bind(this));
		this.agentEvents.on("complete", this.handleAgentCompletion.bind(this));
		this.agentEvents.on("error", this.handleAgentError.bind(this));
	}

	private handleAgentStatusUpdate(status: BackgroundAgentStatus) {
		const task = this.findTaskByAgentThreadId(status.threadId);
		if (task) {
			task.status = "running";
			task.output.push(`Agent status: ${status.status}`);
			this.emit("taskProgress", task, task.progress || 0);
		} else {
			this.tasks.set(status.threadId, {
				id: status.threadId,
				name: status.agentName,
				status: "running",
				startTime: new Date(),
				output: [`Agent status: ${status.status}`],
				cancellable: true,
				pausable: false,
				request: {
					input: status.input,
				},
			});
		}
	}

	private handleAgentCompletion(data: {
		threadId: string;
		status: "completed" | "integrated" | "conflict";
	}) {
		const task = this.findTaskByAgentThreadId(data.threadId);
		if (task) {
			task.status = data.status;
			task.progress = 100;
			task.endTime = new Date();
			task.output.push("Agent completed successfully.");
			this.emit("taskCompleted", task);

			// Terminal notification for background agent completion
			log.success(`Background agent "${task.name}" completed successfully`);
		}
	}

	private handleAgentError(data: { error: string }) {
		const task = this.findTaskByAgentThreadId(this.agent.currentThreadId || "");
		if (task) {
			task.status = "failed";
			task.endTime = new Date();
			task.error = data.error;
			task.output.push(`Agent failed: ${data.error}`);
			this.emit("taskFailed", task, data.error);

			// Terminal notification for background agent error
			log.error(`Background agent "${task.name}" failed: ${data.error}`);
		}
	}

	private findTaskByAgentThreadId(
		agentThreadId: string,
	): BackgroundTask | undefined {
		for (const task of this.tasks.values()) {
			if (task.agentThreadId === agentThreadId) {
				return task;
			}
		}
		return undefined;
	}

	async startTask(
		name: string,
		request: WingmanRequest,
		options: {
			description?: string;
			cancellable?: boolean;
			pausable?: boolean;
		} = {},
	): Promise<string> {
		const taskId = uuidv4();
		const task: BackgroundTask = {
			id: taskId,
			name,
			description: options.description,
			status: "running",
			startTime: new Date(),
			output: [],
			cancellable: options.cancellable ?? true,
			pausable: options.pausable ?? false,
			request,
		};

		this.tasks.set(taskId, task);
		this.emit("taskStarted", task);

		// Start the background work
		this.executeTask(task);

		return taskId;
	}

	private async executeTask(task: BackgroundTask) {
		const abortController = new AbortController();
		this.activeWorkers.set(task.id, abortController);

		try {
			task.output.push(`Started: ${task.name}`);

			// Execute the agent request in the background
			const results: any[] = [];
			for await (const res of this.agent.stream(task.request!)) {
				// Check if task was cancelled
				if (abortController.signal.aborted) {
					task.status = "failed";
					task.endTime = new Date();
					this.emit("taskCancelled", task);
					if (task.agentThreadId) {
						this.agent.terminateBackgroundAgent(task.agentThreadId);
					}
					return;
				}

				results.push(res);

				// Update progress (rough estimate based on streaming)
				const progress = Math.min(90, results.length * 10);
				if (progress !== task.progress) {
					task.progress = progress;
					this.emit("taskProgress", task, progress);
				}

				// Add meaningful output
				if (res.messages && res.messages.length > 0) {
					const lastMessage = res.messages[
						res.messages.length - 1
					] as AIMessage;
					if (lastMessage.content) {
						const preview =
							typeof lastMessage.content === "string"
								? lastMessage.content.substring(0, 100)
								: String(lastMessage.content).substring(0, 100);
						task.output.push(`Progress: ${preview}...`);
					}

					// Check for background agent tool call
					if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
						const toolCall = lastMessage.tool_calls[0] as ToolCall;
						if (
							toolCall.name === "background_agent" &&
							toolCall.args.threadId
						) {
							task.agentThreadId = toolCall.args.threadId;
							task.output.push(
								`Started background agent: ${task.agentThreadId}`,
							);
						}
					}
				}
			}

			// Task completed successfully (unless it's a background agent task)
			if (!task.agentThreadId) {
				task.status = "completed";
				task.progress = 100;
				task.endTime = new Date();
				task.result = results;
				task.output.push(`Completed: ${task.name}`);
				this.emit("taskCompleted", task);
			}
		} catch (error) {
			task.status = "failed";
			task.endTime = new Date();
			task.error = error instanceof Error ? error.message : String(error);
			task.output.push(`Failed: ${task.error}`);

			this.emit("taskFailed", task, task.error);

			logError("TaskManager", error as Error, {
				event: "background_task_execution_error",
				taskId: task.id,
				taskName: task.name,
			});
		} finally {
			this.activeWorkers.delete(task.id);
		}
	}

	private async waitForResume(task: BackgroundTask): Promise<void> {
		return new Promise((resolve) => {
			const checkStatus = () => {
				if (task.status === "running") {
					resolve();
				} else {
					setTimeout(checkStatus, 100);
				}
			};
			checkStatus();
		});
	}

	async showTaskDashboard(): Promise<void> {
		const tasks = Array.from(this.tasks.values());

		if (tasks.length === 0) {
			note("No background tasks found", "Background Tasks");
			return;
		}

		// Sort by status and start time
		const sortedTasks = tasks.sort((a, b) => {
			const statusOrder = {
				running: 0,
				completed: 1,
				failed: 2,
				integrating: 3,
				integrated: 4,
				conflict: 5,
			};
			const statusDiff =
				(statusOrder[a.status] as number) - (statusOrder[b.status] as number);
			if (statusDiff !== 0) return statusDiff;
			return b.startTime.getTime() - a.startTime.getTime();
		});

		const taskList = sortedTasks
			.map((task) => {
				const statusIcon = this.getStatusIcon(task.status);
				const duration = this.formatDuration(task);
				const progress = task.progress ? ` (${task.progress}%)` : "";

				return `${statusIcon} ${task.name}${progress} - ${duration}`;
			})
			.join("\n");

		note(taskList, "Background Tasks");

		// Ask if they want to interact with a task
		const shouldInteract = await confirm({
			message: "Would you like to interact with a task?",
			initialValue: false,
		});

		if (isCancel(shouldInteract) || !shouldInteract) {
			return;
		}

		await this.selectAndInteractWithTask(sortedTasks);
	}

	private async selectAndInteractWithTask(
		tasks: BackgroundTask[],
	): Promise<void> {
		const options = tasks.map((task) => ({
			value: task.id,
			label: `${this.getStatusIcon(task.status)} ${task.name}`,
			hint: `${task.status} - ${this.formatDuration(task)}`,
		}));

		options.push({ value: "back", label: "← Back to chat", hint: "" });

		const selected = await select({
			message: "Select a task to interact with:",
			options,
		});

		if (isCancel(selected) || selected === "back") {
			return;
		}

		const task = this.tasks.get(selected as string);
		if (!task) {
			log.error("Task not found");
			return;
		}

		await this.showTaskDetails(task);
	}

	private async showTaskDetails(task: BackgroundTask): Promise<void> {
		const details = [
			`Name: ${chalk.cyan(task.name)}`,
			`Status: ${this.getStatusIcon(task.status)} ${chalk.bold(task.status.toUpperCase())}`,
			`Started: ${chalk.gray(task.startTime.toLocaleString())}`,
			task.endTime ? `Ended: ${chalk.gray(task.endTime.toLocaleString())}` : "",
			task.progress ? `Progress: ${chalk.cyan(`${task.progress}%`)}` : "",
			task.description ? `Description: ${task.description}` : "",
			task.error ? `Error: ${chalk.red(task.error)}` : "",
			`Duration: ${this.formatDuration(task)}`,
			"",
			"Recent Output:",
			...task.output.slice(-5).map((line) => `  ${chalk.gray(line)}`),
		]
			.filter(Boolean)
			.join("\n");

		note(details, `Task: ${task.name}`);

		// Show available actions
		const actions = this.getAvailableActions(task);
		if (actions.length === 0) {
			return;
		}

		const actionOptions = actions.map((action) => ({
			value: action.value,
			label: action.label,
			hint: action.hint,
		}));

		actionOptions.push({
			value: "back",
			label: "← Back to task list",
			hint: "",
		});

		const selectedAction = await select({
			message: "What would you like to do?",
			options: actionOptions,
		});

		if (isCancel(selectedAction) || selectedAction === "back") {
			return;
		}

		await this.executeTaskAction(task, selectedAction as string);
	}

	private getAvailableActions(task: BackgroundTask) {
		const actions = [];

		if (task.status === "running" && task.cancellable) {
			actions.push({
				value: "cancel",
				label: "🛑 Cancel Task",
				hint: "Stop the task",
			});
		}

		if (task.status === "completed" && task.result) {
			actions.push({
				value: "view_result",
				label: "👁️ View Result",
				hint: "Show task result",
			});
		}

		if (task.status === "failed" && task.cancellable) {
			actions.push({
				value: "retry",
				label: "🔄 Retry Task",
				hint: "Retry the failed task",
			});
		}

		actions.push({
			value: "view_output",
			label: "📄 View Full Output",
			hint: "Show all task output",
		});

		return actions;
	}

	private async executeTaskAction(
		task: BackgroundTask,
		action: string,
	): Promise<void> {
		switch (action) {
			case "view_result":
				if (task.result) {
					// Format and display the result
					const resultStr = JSON.stringify(task.result, null, 2);
					note(resultStr, `Result: ${task.name}`);
				}
				break;

			case "view_output": {
				const output = task.output.join("\n");
				note(output || "No output available", `Output: ${task.name}`);
				break;
			}

			case "retry":
				if (task.request) {
					const newTaskId = await this.startTask(
						`${task.name} (Retry)`,
						task.request,
						{
							description: task.description,
							cancellable: task.cancellable,
							pausable: task.pausable,
						},
					);
					log.success(`Retrying task as: ${newTaskId}`);
				}
				break;
		}
	}

	getRunningTasksCount(): number {
		return Array.from(this.tasks.values()).filter((t) => t.status === "running")
			.length;
	}

	getTasksStatusSummary(): string {
		const tasks = Array.from(this.tasks.values());
		const running = tasks.filter((t) => t.status === "running").length;
		const completed = tasks.filter((t) => t.status === "completed").length;
		const failed = tasks.filter((t) => t.status === "failed").length;

		if (running === 0 && completed === 0 && failed === 0) {
			return "";
		}

		const parts = [];
		if (running > 0) parts.push(`${running} running`);
		if (completed > 0) parts.push(`${completed} completed`);
		if (failed > 0) parts.push(`${failed} failed`);

		return `[${parts.join(", ")}]`;
	}

	private getStatusIcon(status: BackgroundTask["status"]): string {
		switch (status) {
			case "running":
				return "🔄";
			case "completed":
				return "✅";
			case "failed":
				return "❌";
			case "integrating":
				return "🔗";
			case "integrated":
				return "🔗";
			case "conflict":
				return "⚠️";
			default:
				return "❓";
		}
	}

	private formatDuration(task: BackgroundTask): string {
		const endTime = task.endTime || new Date();
		const duration = endTime.getTime() - task.startTime.getTime();
		const seconds = Math.floor(duration / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		}
		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		}
		return `${seconds}s`;
	}

	// Clean up completed/failed tasks older than 24 hours
	cleanup(): void {
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

		for (const [id, task] of this.tasks.entries()) {
			if (
				(task.status === "completed" || task.status === "failed") &&
				task.endTime &&
				task.endTime < oneDayAgo
			) {
				this.tasks.delete(id);
			}
		}
	}
}
