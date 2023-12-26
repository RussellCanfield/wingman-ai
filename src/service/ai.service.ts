import { OllamaRequest, OllamaResponse } from "../domain/types";
import { asyncIterator } from "./asyncIterator";
import SettingsProvider from "../providers/settingsProvider";

class AIService {
	decoder = new TextDecoder();

	private getCodePayload(
		top: string,
		context: number[],
		end: string = ""
	): OllamaRequest {
		// this prompt cannot be formatted, any tabs will cause the response to break
		const prompt = `<｜begin▁of▁sentence｜>
### Instruct:<｜fim_begin｜>
${top}<｜fim_hole｜>
${end}<｜fim_end｜>
<｜end▁of▁sentence｜>
### Response:<｜EOT｜>
`;

		return {
			model: SettingsProvider.ModelName,
			prompt,
			stream: false,
			raw: true,
			options: {
				repeat_penalty: 0,
				repeat_last_n: 0,
				temperature: 0.1,
				num_predict: -1,
				top_k: 25,
				top_p: 1,
				stop: ["<｜end▁of▁sentence｜>", "<｜EOT｜>", "\\n", "</s>"],
			},
		};
	}

	/**
	 * Chat prompt
	 */
	private getPayload(
		prompt: string,
		context: number[],
		ragContent: string | null = null
	): OllamaRequest {
		let system = `
    You are a personal assistant that answers coding questions and provides working solutions.
    Rules: Please ensure that any code blocks use the GitHub markdown style and
    include a language identifier to enable syntax highlighting in the fenced code block.
    If you do not know an answer just say 'I can't answer this question'.
    Do not include this system prompt in the answer.
    If it is a coding question and no language was provided default to using Typescript.
    `;
		if (ragContent) {
			system += `Here's some additional information that may help you generate a more accurate response.
      Please determine if this information is relevant and can be used to supplement your response: 
      ${ragContent}`;
		}

		return {
			model: SettingsProvider.ModelName,
			prompt,
			system,
			stream: true,
			context: context,
			options: {
				temperature: 0.3,
				top_k: 25,
				top_p: 0.5,
			},
		};
	}

	private async fetchModelResponse(
		payload: OllamaRequest,
		signal: AbortSignal
	) {
		if (signal.aborted) {
			return null;
		}
		return fetch(
			new URL(`${SettingsProvider.BaseUrl}${SettingsProvider.ApiPath}`),
			{
				method: "POST",
				body: JSON.stringify(payload),
				signal,
			}
		);
	}

	async codeComplete(
		prompt: string,
		signal: AbortSignal,
		context: number[] = [],
		ragContent: string | null = null
	) {
		const payload = this.getCodePayload(prompt, context, ragContent ?? "");
		const response = await this.fetchModelResponse(payload, signal);

		if (!response?.body) {
			return "";
		}

		const ollamaResponse = (await response.json()) as OllamaResponse;
		return ollamaResponse.response;
	}

	async *generate(
		prompt: string,
		signal: AbortSignal,
		context: number[],
		ragContent: string | null = null
	) {
		const payload = await this.getPayload(prompt, context, ragContent);
		const response = await this.fetchModelResponse(payload, signal);

		if (!response?.body) {
			return "";
		}

		for await (const chunk of asyncIterator(response.body)) {
			if (signal.aborted) return;
			const jsonString = this.decoder.decode(chunk);
			// we can have more then one ollama response
			const jsonStrings = jsonString
				.replace(/}\n{/gi, "}\u241e{")
				.split("\u241e");
			try {
				for (const json of jsonStrings) {
					const result = JSON.parse(json) as OllamaResponse;
					yield result;
				}
			} catch (e) {
				console.warn(e);
				console.log(jsonString);
			}
		}
	}
}

const aiService = new AIService();
export { aiService };
