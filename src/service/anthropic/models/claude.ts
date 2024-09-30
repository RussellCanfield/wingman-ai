import { AnthropicModel } from "@shared/types/Models";
import {
	commonChatPrompt,
	commonDocPrompt,
	commonRefactorPrompt,
} from "../../common";

export class ClaudeModel implements AnthropicModel {
	get CodeCompletionPrompt(): string {
		return `Fill in the following text.
Do not include the original text in your response, just the middle portion.
Return your response in plain text, do not use a markdown format.
If the code provided does not provide a clear intent and you are unable to complete the code, respond with an empty string "".

{beginning} <FILL_HOLE> {ending}`;
	}

	get ChatPrompt(): string {
		return commonChatPrompt;
	}

	get genDocPrompt(): string {
		return commonDocPrompt;
	}

	get refactorPrompt(): string {
		return commonRefactorPrompt;
	}
}
