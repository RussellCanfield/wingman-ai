// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ChatViewProvider } from "./providers/chatViewProvider.js";
import { CodeSuggestionProvider } from "./providers/codeSuggestionProvider.js";
import { Ollama } from "./service/llm.js";
import { LlamaModel, LlamaContext, LlamaChatSession } from "@node-llama";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(
		'Congratulations, your extension "code-assistant" is now active!'
	);

	try {
		const modelPath = vscode.Uri.joinPath(
			context.extensionUri,
			"out",
			"models",
			"deepseek-coder-1.3b-instruct.Q4_0.gguf"
		).toString();

		const binPath = vscode.Uri.joinPath(
			context.extensionUri,
			"out",
			"llamaBins"
		).toString();

		const model = new LlamaModel({});
		await model.initialize({ binPath, modelPath });
		const modelContext = new LlamaContext({ model });
		const session = new LlamaChatSession({ context: modelContext });

		await session.prompt("testing", {
			onToken(chunk: any) {
				console.log(modelContext.decode(chunk));
			},
		});
	} catch (error) {
		console.error(error);
	}

	const model = new Ollama({
		model: "deepseek-coder",
		temperature: 0.7,
		p: 0.2,
		k: 30,
		baseUrl: "http://localhost:11434",
	});

	const provider = new ChatViewProvider(model, context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ChatViewProvider.viewType,
			provider
		)
	);

	context.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider(
			CodeSuggestionProvider.selector,
			new CodeSuggestionProvider(model)
		)
	);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand(
		"code-assistant.helloWorld",
		() => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			vscode.window.showInformationMessage(
				"Hello World from code-assistant!"
			);
		}
	);

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
