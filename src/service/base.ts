import * as vscode from "vscode";
import { loggingProvider } from "../providers/loggingProvider";
import { AIModel } from "../types/Models";
import { InteractionSettings, Settings } from "../types/Settings";
import { HuggingFace } from "./huggingface/huggingface";
import { Ollama } from "./ollama/ollama";
import { OpenAI } from "./openai/openai";
import { Anthropic } from "./anthropic/anthropic";

export function GetAllSettings(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration("Wingman");
}

export function GetInteractionSettings(): InteractionSettings {
	const config = vscode.workspace.getConfiguration("Wingman");

	const interactionSettings = config.get<Settings["interactionSettings"]>(
		"InteractionSettings"
	)!;

	if (interactionSettings) {
		return interactionSettings;
	}

	return {
		codeCompletionEnabled: true,
		codeStreaming: false,
		codeContextWindow: 256,
		codeMaxTokens: -1,
		chatContextWindow: 4096,
		chatMaxTokens: 4096,
	};
}

export function GetProviderFromSettings(): AIProvider {
	const config = vscode.workspace.getConfiguration("Wingman");

	const aiProvider = config
		.get<Settings["aiProvider"]>("Provider")
		?.toLocaleLowerCase()
		.trim();

	loggingProvider.logInfo(`AI Provider: ${aiProvider} found.`);

	if (aiProvider === "huggingface") {
		return new HuggingFace();
	} else if (aiProvider === "openai") {
		return new OpenAI();
	} else if (aiProvider === "anthropic") {
		return new Anthropic();
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
		signal: AbortSignal,
		additionalContext?: string
	): Promise<string>;
	chat(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): AsyncGenerator<string>;
	genCodeDocs(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string>;
	refactor(
		prompt: string,
		ragContent: string,
		signal: AbortSignal
	): Promise<string>;
}

export interface AIStreamProvicer extends AIProvider {
	codeCompleteStream(
		beginning: string,
		ending: string,
		signal: AbortSignal,
		additionalContext?: string
	): Promise<string>;
}
