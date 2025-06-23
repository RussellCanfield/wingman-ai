import vscode, {
	CompletionTriggerKind,
	type QuickPickItem,
	SnippetString,
} from "vscode";
import { eventEmitter } from "../events/eventEmitter";
import { getContentWindow } from "../service/utils/contentWindow";
import { EVENT_CODE_COMPLETE_HOTKEY, telemetry } from "./telemetryProvider";
import { wingmanSettings } from "../service/settings";
import { CreateAIProvider } from "../service/utils/models";
import { loggingProvider } from "./loggingProvider";

export class HotKeyCodeSuggestionProvider
	implements vscode.CompletionItemProvider
{
	static provider: HotKeyCodeSuggestionProvider | null = null;
	async provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		_: vscode.CompletionContext,
	): Promise<
		vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
	> {
		const abort = new AbortController();

		token.onCancellationRequested(() => {
			try {
				abort.abort();
			} finally {
				eventEmitter._onQueryComplete.fire();
			}
		});

		if (abort.signal.aborted) {
			return [];
		}

		try {
			const settings = await wingmanSettings.loadSettings();
			const aiProvider = CreateAIProvider(settings, loggingProvider);

			const [prefix, suffix] = getContentWindow(
				document,
				position,
				settings.interactionSettings.codeContextWindow,
			);
			//get the biginning of the last line in prefix
			const lastLineStart = prefix.lastIndexOf("\n");
			// count the starting spaces in the last line
			const spaces = prefix.substring(lastLineStart + 1).search(/\S/) ?? 0;

			eventEmitter._onQueryStart.fire();
			try {
				telemetry.sendEvent(EVENT_CODE_COMPLETE_HOTKEY, {
					language: document.languageId,
					aiProvider: settings.aiProvider,
					model:
						settings.providerSettings[settings.aiProvider]?.codeModel ||
						"Unknown",
				});
			} catch {}
			const response = await aiProvider.codeComplete(
				prefix,
				suffix,
				abort.signal,
			);
			const snippet = new vscode.SnippetString(
				response.replace(new RegExp(`\n[\\s]{${spaces}}`, "g"), "\n"),
			);
			const item = new vscode.CompletionItem(
				response,
				vscode.CompletionItemKind.Snippet,
			);
			item.insertText = snippet;
			return [item];
		} catch (error) {
			console.error(error);
			return [];
		} finally {
			eventEmitter._onQueryComplete.fire();
		}
	}

	static command = "wingmanai.triggercodecomplete";
	static async showSuggestion() {
		const editor = vscode.window.activeTextEditor;
		if (!editor || !HotKeyCodeSuggestionProvider.provider) {
			return;
		}
		const documnet = editor.document;
		const position = editor.selection.active;
		const token = new vscode.CancellationTokenSource().token;
		const context: vscode.CompletionContext = {
			triggerKind: CompletionTriggerKind.Invoke,
			triggerCharacter: "ctrl+shift+space",
		};

		const items =
			await HotKeyCodeSuggestionProvider.provider.provideCompletionItems(
				documnet,
				position,
				token,
				context,
			);
		if (!items || !Array.isArray(items)) {
			return;
		}
		if (!items.length) {
			return;
		}
		const quickPickItem: QuickPickItem = {
			label: "Code Suggestion",
			description: (items[0].insertText as SnippetString).value,
		};
		const lines = quickPickItem.description!.split("\n");
		const decoratorsForEachLine: [
			vscode.TextEditorDecorationType,
			vscode.Range,
		][] = lines.map((line, index) => {
			const range = new vscode.Range(
				position.translate(index, 0),
				position.translate(index, line.length),
			);
			return [
				vscode.window.createTextEditorDecorationType({
					after: {
						color: new vscode.ThemeColor("editorSuggestWidget.foreground"),
						contentText: line,
					},
				}),
				range,
			];
		});
		// add new lines to the editor
		editor.insertSnippet(
			new SnippetString("\n".repeat(lines.length)),
			position,
		);
		// biome-ignore lint/complexity/noForEach: <explanation>
		decoratorsForEachLine.forEach(([decorator, range]) => {
			editor.setDecorations(decorator, [range]);
		});
		const selected = await vscode.window.showQuickPick([quickPickItem]);
		// remove the new lines from the editor
		const linesEnd = position.translate(lines.length, 0);
		const range = new vscode.Range(position, linesEnd);
		await editor.edit((editBuilder) => {
			editBuilder.delete(range);
		});
		if (selected) {
			const insertText = items[0].insertText as SnippetString;
			editor.insertSnippet(insertText, position);
		}
		// biome-ignore lint/complexity/noForEach: <explanation>
		decoratorsForEachLine.forEach(([decorator]) => {
			decorator.dispose();
		});
	}
}
