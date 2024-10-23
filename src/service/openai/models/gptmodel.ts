import { OpenAIModel } from "@shared/types/Models";
import {
	commonChatPrompt,
	commonDocPrompt,
	commonRefactorPrompt,
} from "../../common";

export class GPTModel implements OpenAIModel {
	get CodeCompletionPrompt(): string {
		return `Fill in the following text.

**Rules**
1. Do not include the original text in your response, just the middle portion.
2. Return your response in plain text, do not use a markdown format.
3. If the code provided does not provide a clear intent and you are unable to complete the code, respond with an empty string "".
4. Do not include any leading or trailing text with an explanation or intro. Just the middle section.

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
