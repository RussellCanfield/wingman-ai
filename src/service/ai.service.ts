import { OllamaRequest, OllamaResponse } from "../domain/types";
import { asyncIterator } from "./asyncIterator";
import SettingsProvider from "../providers/settingsProvider";

class AIService {
	decoder = new TextDecoder();

	public async validateModelExists(modelName: string): Promise<boolean> {
		try {
			const response = await fetch(
				new URL(
					`${SettingsProvider.BaseUrl}${SettingsProvider.InfoPath}`
				),
				{
					method: "POST",
					body: JSON.stringify({
						name: modelName,
					}),
				}
			);

			if (response.status === 200) {
				return true;
			}
		} catch (error) {
			console.warn(error);
		}

		return false;
	}

	public async fetchModelResponse(
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

	async codeComplete(payload: OllamaRequest, signal: AbortSignal) {
		const response = await this.fetchModelResponse(payload, signal);

		if (!response?.body) {
			return "";
		}

		const ollamaResponse = (await response.json()) as OllamaResponse;
		return ollamaResponse.response;
	}

	async *generate(
		payload: OllamaRequest,
		signal: AbortSignal,
		ragContent: string | null = null
	) {
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
