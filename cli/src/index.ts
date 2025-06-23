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
import { Checkpoint, MemorySaver } from "@langchain/langgraph";

const program = new Command();

program
	.version("1.0.0")
	.description("An AI coding assistant for your terminal.")
	.argument("[prompt]", "The prompt to send to the agent")
	.parse(process.argv);

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

async function processInput(
	input: string,
	agent: WingmanAgent,
	checkpointer: MemorySaver,
	threadId: string,
) {
	let spinner: Ora | null = null;
	let toolName: string | null = null;

	process.stdout.write(chalk.cyan("Wingman: "));

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
					if (!spinner) {
						spinner = ora(`Executing tool: ${chalk.bold(toolName)}...`).start();
					} else {
						spinner.text = `Executing tool: ${chalk.bold(toolName)}...`;
					}
				}
			}

			if (
				message.content &&
				typeof message.content === "string" &&
				message.content.trim()
			) {
				if (spinner) {
					spinner.stop();
					spinner = null;
				}
				process.stdout.write(message.content);
			}
		}

		if (message instanceof ToolMessage) {
			if (spinner && toolName) {
				spinner.succeed(`Tool '${chalk.bold(toolName)}' executed.`);
				spinner = null;
				toolName = null;
				process.stdout.write(chalk.cyan("Wingman: "));
			}
		}
	}

	if (spinner) {
		spinner.stop();
	}

	console.log("\n");
}

async function main() {
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
	const initialPrompt = program.args.join(" ");

	if (initialPrompt) {
		// Non-interactive mode
		console.log(chalk.green(`You: ${initialPrompt}`));
		await processInput(initialPrompt, agent, checkpointer, threadId);
		rl.close();
	} else {
		// Interactive mode
		console.log(wingmanArt);
		console.log(chalk.bold.blue("Welcome to the Wingman CLI!"));
		console.log(chalk.blue("Your AI coding assistant."));
		console.log(chalk.gray('Type "quit" or "exit" to end the session.'));
		console.log("");

		const chat = () => {
			rl.question(chalk.green("You: "), async (input) => {
				if (input.toLowerCase() === "quit" || input.toLowerCase() === "exit") {
					console.log(chalk.yellow("Goodbye!"));
					rl.close();
					return;
				}
				await processInput(input, agent, checkpointer, threadId);
				chat();
			});
		};
		chat();
	}
}

main().catch((error) => {
	console.error(chalk.red("An error occurred:"), error);
	rl.close();
});
