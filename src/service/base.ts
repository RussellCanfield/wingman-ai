import * as vscode from "vscode";
import { Ollama } from "./ollama/ollama";
import { Settings } from "../types/Settings";
import { HuggingFace } from "./huggingface/huggingface";
import { AIModel } from "../types/Models";
import { loggingProvider } from "../providers/loggingProvider";

export function GetProviderFromSettings(): AIProvider {
	const config = vscode.workspace.getConfiguration("Wingman");

	const aiProvider = config
		.get<Settings["aiProvider"]>("Provider")
		?.toLocaleLowerCase()
		.trim();

	loggingProvider.logInfo(`AI Provider: ${aiProvider} found.`);

	if (aiProvider === "huggingface") {
		return new HuggingFace();
	}

	return new Ollama();
}

export interface AIProvider {
	chatModel: AIModel | undefined;
	codeModel: AIModel | undefined;
	clearChatHistory(): void;
	codeComplete(
		beginning: string,
		ending: string,
		signal: AbortSignal
	): Promise<string>;
	chat(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): AsyncGenerator<string>;
}
