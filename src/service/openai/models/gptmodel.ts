import { OpenAIModel } from "@shared/types/Models";
import {
	commonChatPrompt,
	commonDocPrompt,
	commonRefactorPrompt,
} from "../../common";

export class GPTModel implements OpenAIModel {
	get CodeCompletionPrompt(): string {
		return `Complete the missing code in the following snippet. The missing part is indicated by <|FIM_HOLE|>. 
Ensure the completed code is syntactically correct and follows best practices for the given programming language.

**Rules**
1. Do not include the original text in your response, just the middle portion.
2. Return your response in plain text, do not use a markdown format.
3. If the code provided does not provide a clear intent and you are unable to complete the code, respond with an empty response.
4. Do not repeat sections of code around the hole, look to generate high quality unique code.
5. Do not include any leading or trailing text with an explanation or intro. Just the middle section.

{context}

Code:
{beginning}<|FIM_HOLE|>{ending}`;
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
