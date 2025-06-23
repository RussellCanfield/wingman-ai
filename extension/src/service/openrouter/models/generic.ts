import type { AIModel } from "@shared/types/Models";

export class OpenRouterModel implements AIModel {
	get CodeCompletionPrompt(): string {
		return `You are a senior full-stack developer specializing in writing clean, maintainable code and natural language content.

**Objective:**
Complete the content marked by <|FIM_HOLE|> with high-quality output that matches the style and context of the surrounding content, whether it's code, documentation, or natural language.

**Rules:**
- Generate only the content that replaces <|FIM_HOLE|>
- Return plain text without markdown formatting
- Adapt completion style based on content type:
	• For code: Follow existing style, patterns, and type safety
	• For prompts: Match tone, formatting, and instruction style
	• For text: Maintain consistent voice and terminology
- Preserve existing:
	• Indentation and formatting
	• Language patterns
	• Technical terminology
- If intent is unclear, return an empty response
- Consider surrounding context for better continuity

{context}

**CRITICAL:**
- Do not return any other text or explanations, just the missing portion of code

Code:
{beginning}<|FIM_HOLE|>{ending}`;
	}
}
