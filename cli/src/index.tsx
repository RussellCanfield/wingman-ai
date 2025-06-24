
import { Command } from "commander";
import { render } from "ink";
import UI from "./ui";
import { WingmanProvider } from "./contexts/WingmanContext";

const program = new Command();

program
	.version("1.0.0")
	.description("An AI coding assistant for your terminal.")
	.argument("[prompt...]", "The prompt to send to the agent")
	.action(async (promptParts: string[]) => {
		const initialPrompt =
			promptParts && promptParts.length > 0 ? promptParts.join(" ") : undefined;

		const app = render(
			<WingmanProvider initialPrompt={initialPrompt}>
				<UI />
			</WingmanProvider>,
		);
		await app.waitUntilExit();
	});

program.parse(process.argv);
