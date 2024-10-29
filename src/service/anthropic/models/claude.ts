import { AnthropicModel } from "@shared/types/Models";
import {
	commonChatPrompt,
	commonDocPrompt,
	commonRefactorPrompt,
} from "../../common";

export class ClaudeModel implements AnthropicModel {
	get CodeCompletionPrompt(): string {
		return `Complete the missing code in the following snippet. The missing part is indicated by <|FIM_HOLE|>. 
Ensure the completed code is syntactically correct and follows best practices for the given programming language.

**Rules:**
- Preserve the code's structure, order, comments, and indentation exactly.
- When generating code focus on existing code style, syntax, and structure and follow use this as a guide.
- Do not include any additional text, explanations, placeholders, ellipses, or code fences.
- Do not repeat sections of code around the hole, look to generate high quality unique code.
- If you are unable to generate code that fits, respond with an empty response.

{context}

-----

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
