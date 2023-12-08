// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ChatViewProvider } from "./providers/chatViewProvider.js";
import { CodeSuggestionProvider } from "./providers/codeSuggestionProvider.js";
import { Ollama } from "./service/llm.js";

//@ts-ignore
import init, { greet } from "./wasm/llm_wasm.js";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(
		'Congratulations, your extension "code-assistant" is now active!'
	);

	try {
		const path = vscode.Uri.joinPath(
			context.extensionUri,
			"out",
			"wasm",
			"llm_wasm_bg.wasm"
		);

		const wasmFile = vscode.workspace.fs.readFile(path);

		await init(wasmFile);
		console.log(greet(path.toString()));
	} catch (error) {
		console.error(error);
	}

	// try {
	// 	const webllm = await import("@mlc-ai/web-llm");

	// 	const chat = new webllm.ChatModule();
	// 	// This callback allows us to report initialization progress
	// 	// chat.setInitProgressCallback((report: webllm.InitProgressReport) => {
	// 	// 	setLabel("init-label", report.text);
	// 	// });
	// 	// You can also try out "RedPajama-INCITE-Chat-3B-v1-q4f32_1"

	// 	await chat.reload(
	// 		"deepseek-coder-1.3b-base-q4f16_1-webgpu",
	// 		{
	// 			repetition_penalty: 1.01,
	// 		},
	// 		{
	// 			model_list: [
	// 				{
	// 					model_url: "",
	// 					local_id: "deepseek-coder-1.3b-base-q4f16_1-webgpu",
	// 				},
	// 			],
	// 			model_lib_map: {
	// 				"deepseek-coder-1.3b-base-q4f16_1-webgpu":
	// 					"/models/deepseek-coder-1.3b-base-q4f16_1-webgpu.wasm",
	// 			},
	// 		}
	// 	);

	// 	const generateProgressCallback = (_step: number, message: string) => {
	// 		console.log(_step, message);
	// 	};

	// 	const prompt0 = "What is the capital of Canada?";
	// 	//setLabel("prompt-label", prompt0);
	// 	const reply0 = await chat.generate(prompt0, generateProgressCallback);
	// 	console.log(reply0);

	// 	const prompt1 = "Can you write a poem about it?";
	// 	//setLabel("prompt-label", prompt1);
	// 	const reply1 = await chat.generate(prompt1, generateProgressCallback);
	// 	console.log(reply1);

	// 	console.log(await chat.runtimeStatsText());
	// } catch (error) {
	// 	console.error(error);
	// }

	const model = new Ollama({
		model: "zephyr",
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
