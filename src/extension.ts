// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ChatViewProvider } from "./providers/chatViewProvider.js";
import { CodeSuggestionProvider } from "./providers/codeSuggestionProvider.js";
import { Ollama } from "./service/llm.js";
import SettingsProvider from "./providers/settingsProvider.js";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(
		'Congratulations, your extension "code-assistant" is now active!'
	);
	// const modelPath = vscode.Uri.joinPath(
	// 	context.extensionUri,
	// 	"out",
	// 	"models",
	// 	"deepseek-coder-5.7bmqa-base.Q4_0.gguf"
	// ).toString();

	// const binPath = vscode.Uri.joinPath(
	// 	context.extensionUri,
	// 	"out",
	// 	"llamaBins"
	// ).toString();

	// const model = new LlamaModel({});
	// await model.initialize({
	// 	binPath,
	// 	modelPath,
	// });
	// const modelContext = new LlamaContext({ model });
	// const session = new LlamaChatSession({ context: modelContext });

	await SettingsProvider.Load();

	const ollamaModel = new Ollama({
		model: SettingsProvider.Settings.modelName,
		baseUrl: "http://localhost:11434",
	});

	const provider = new ChatViewProvider(ollamaModel, context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ChatViewProvider.viewType,
			provider
		)
	);

	context.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider(
			CodeSuggestionProvider.selector,
			new CodeSuggestionProvider(ollamaModel)
		)
	);

	// context.subscriptions.push(
	// 	vscode.languages.registerCompletionItemProvider(
	// 		CodeSuggestionProvider.selector,
	// 		new CodeSuggestionProvider(ollamaModel)
	// 	)
	// )

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
