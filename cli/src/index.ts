import { Command } from "commander";
import { WingmanAgent, type WingmanGraphState } from "@wingman-ai/agent";
import readline from "node:readline";
import { ChatOpenAI } from "@langchain/openai";
import { wingmanArt } from "./art";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import {
	AIMessage,
	AIMessageChunk,
	ToolMessage,
	type BaseMessage,
} from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";
import { MemorySaver } from "@langchain/langgraph";

const program = new Command();

async function processInput(
	input: string,
	agent: WingmanAgent,
	checkpointer: MemorySaver,
	threadId: string,
	spinner: Ora,
) {
	spinner.start("Thinking...");
	let toolName: string | null = null;
	let wingmanPrefixPrinted = false;

	try {
		for await (const res of agent.stream(
			{
				input: input,
				threadId,
			},
			checkpointer,
		)) {
			const { messages } = res as WingmanGraphState;
			const message = messages[messages.length - 1] as BaseMessage;

			if (message instanceof AIMessageChunk || message instanceof AIMessage) {
				if (message.tool_calls && message.tool_calls.length > 0) {
					const toolCallChunk = message.tool_calls[0];
					if (toolCallChunk?.name) {
						toolName = toolCallChunk.name;
						spinner.text = `Executing tool: ${chalk.bold(toolName)}...`;
					}
				}

				if (
					message.content &&
					typeof message.content === "string" &&
					message.content.trim()
				) {
					if (spinner.isSpinning) {
						spinner.stop();
					}
					if (!wingmanPrefixPrinted) {
						process.stdout.write(chalk.cyan("Wingman: "));
						wingmanPrefixPrinted = true;
					}
					process.stdout.write(message.content);
				}
			}

			if (message instanceof ToolMessage) {
				if (toolName) {
					spinner.succeed(`Tool '${chalk.bold(toolName)}' executed.`);
					toolName = null;
					spinner.start("Thinking...");
				}
			}
		}
	} finally {
		if (spinner.isSpinning) {
			spinner.stop();
		}
		if (wingmanPrefixPrinted) {
			process.stdout.write("\n");
		}
	}
}

async function startChatSession(initialPrompt?: string) {
	let spinner: Ora | null = null;

	const cleanupAndExit = () => {
		if (spinner?.isSpinning) {
			spinner.stop();
		}
		console.log(chalk.yellow("\nGoodbye!"));
		process.exit(0);
	};

	process.on("SIGINT", () => {
		console.log(
			chalk.yellow("\nCaught interrupt signal. Shutting down gracefully..."),
		);
		cleanupAndExit();
	});

	const checkpointer = new MemorySaver();
	const agent = new WingmanAgent({
		name: "Wingman CLI Agent",
		model: new ChatOpenAI({
			model: "gpt-4o",
		}),
		workingDirectory: process.cwd(),
	});
	await agent.initialize();
	const threadId = uuidv4();

	console.log(wingmanArt);
	console.log(chalk.bold.blue("Welcome to the Wingman CLI!"));
	console.log(chalk.blue("Your AI coding assistant."));
	console.log(chalk.gray('Type "quit" or "exit" to end the session.'));
	console.log("");

	const promptUser = (): Promise<string> => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		return new Promise((resolve) => {
			rl.question(chalk.green("You: "), (input) => {
				rl.close();
				resolve(input);
			});
		});
	};

	if (initialPrompt) {
		try {
			console.log(chalk.green(`You: ${initialPrompt}`));
			spinner = ora({ stream: process.stderr });
			await processInput(initialPrompt, agent, checkpointer, threadId, spinner);
		} catch (error) {
			if (spinner?.isSpinning) spinner.stop();
			console.error(
				chalk.red("\nAn error occurred while processing the initial prompt:"),
				error,
			);
		}
	}

	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			const input = await promptUser();

			if (input.toLowerCase() === "quit" || input.toLowerCase() === "exit") {
				break;
			}

			spinner = ora({ stream: process.stderr });
			await processInput(input, agent, checkpointer, threadId, spinner);
		} catch (error) {
			if (spinner?.isSpinning) spinner.stop();
			console.error(chalk.red("\nAn unexpected error occurred:"), error);
		}
	}

	cleanupAndExit();
}

program
	.version("1.0.0")
	.description("An AI coding assistant for your terminal.")
	.argument("[prompt...]", "The prompt to send to the agent")
	.action(async (promptParts: string[]) => {
		const initialPrompt =
			promptParts && promptParts.length > 0 ? promptParts.join(" ") : undefined;
		await startChatSession(initialPrompt);
	});

program.parse(process.argv);