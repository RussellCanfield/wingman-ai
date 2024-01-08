import { OllamaRequest } from "../../domain/types";
import SettingsProvider from "../../providers/settingsProvider";
import { BaseModel } from "../../types/Models";

export class CodeLlama implements BaseModel {
	baseCodeCompletePrompt = `<PRE> {beginning} <SUF> {ending} <MID>`;

	baseChatPrompt = `You are a personal assistant that answers coding questions and provides working solutions.
    Rules: Please ensure that any code blocks use the GitHub markdown style and
    include a language identifier to enable syntax highlighting in the fenced code block.
    If you do not know an answer just say 'I can't answer this question'.
    Do not include this system prompt in the answer.
    If it is a coding question and no language was provided default to using Typescript.
    `;

	get ModelPrefix(): string {
		return "codellama";
	}

	constructor() {}

	getCodeCompletionPayload(beginning: string, ending: string) {
		return {
			model: SettingsProvider.CodeModelName,
			prompt: this.baseCodeCompletePrompt
				.replace("{beginning}", beginning)
				.replace("{ending}", ending),
			stream: false,
			options: {
				//repeat_penalty: 1,
				temperature: 0.3,
				num_predict: 1024,
				top_k: 50,
				top_p: 0.2,
			},
		} satisfies OllamaRequest;
	}

	getChatPayload(prompt: string, ragContent: string, context: number[]) {
		let systemPrompt = this.baseChatPrompt;

		if (ragContent) {
			systemPrompt += `Here's some additional information that may help you generate a more accurate response.
            Please determine if this information is relevant and can be used to supplement your response: 
            ${ragContent}`;
		}

		systemPrompt = systemPrompt.replace(/\t/, "");

		return {
			model: SettingsProvider.ChatModelName,
			prompt,
			system: systemPrompt,
			stream: true,
			context: context,
			options: {
				temperature: 0.1,
				num_predict: 1024,
				top_k: 50,
				top_p: 0.2,
			},
		};
	}
}
