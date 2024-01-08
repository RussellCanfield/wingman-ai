import { OllamaRequest } from "../domain/types";

export abstract class BaseModel {
	abstract get ModelPrefix(): string;

	abstract getCodeCompletionPayload(
		beginning: string,
		ending: string
	): OllamaRequest;

	abstract getChatPayload(
		prompt: string,
		ragContent: string,
		context: number[]
	): OllamaRequest;
}
