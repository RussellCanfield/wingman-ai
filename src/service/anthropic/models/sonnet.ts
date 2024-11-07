import { AnthropicModel } from "@shared/types/Models";
import {
	commonChatPrompt,
	commonDocPrompt,
	commonRefactorPrompt,
} from "../../common";

export class SonnetModel implements AnthropicModel {
	get CodeCompletionPrompt(): string {
		return `Complete the code indicated by [FILL IN THE MIDDLE]. 
Only provide the exact code that should replace the hole marker. 

**Critical Requirements:**
1. Generate ONLY the middle section of code - no explanations, markers, or decorators
  - Do not include the line prefix where the middle token appears
2. Match the exact:
  - Indentation level
  - Coding style
  - Variable naming conventions
  - Programming paradigms
3. Ensure syntactic and logical continuity between sections
4. Preserve all:
  - Comments
  - Whitespace patterns
  - Formatting conventions

**Strict Constraints:**
- No leading/trailing text
- No code fences or markup
- No placeholders or TODOs
- No duplicate code from beginning/ending
- Return empty response if unable to generate suitable code

**Context Handling:**
- Use provided context to inform implementation details
- Maintain consistency with any established patterns
- Honor existing architectural decisions
- Respect apparent security/performance considerations

{context}`;
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
