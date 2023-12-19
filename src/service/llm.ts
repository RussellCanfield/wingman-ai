import { ReadableStream } from "stream/web";

export interface ModelOptions {
	baseUrl: string;
	model?: string;
}

export interface ModelResponse {
	response: string;
}

export type ModelStream = ReadableStream<Uint8Array> &
	AsyncIterable<Uint8Array>;

export interface BaseModel extends ModelOptions {
	stream: (prompt: string, options?: OllamaModelOptions) => Promise<Response>;
	execute: (
		prompt: string,
		options?: OllamaModelOptions
	) => Promise<ModelResponse>;
}

export interface OllamaModelOptions {
	stream: boolean;
	temperature?: number;
	k?: number;
	p?: number;
	additionalStopTokens?: string[];
}

const defaultStopTokens = ["user:", "</s>"];

export class Ollama implements BaseModel {
	model?: string;
	baseUrl: string;

	constructor(options: ModelOptions) {
		this.model = options.model ?? "llama2";
		this.baseUrl = options.baseUrl ?? "http://localhost:11434";
	}

	withBasePrompt = (prompt: string) =>
		`<|system|>You are a highly skilled software engineer, capable of solving any problem. 
		Please give clear and concise answers to the following question. If you don't know the answer just say you don't know, do not make up an answer. 
		The answer should be technical in nature, use the following format:
		
		<explanation>
		\`\`\`<language>
		<code>
		\`\`\`

		Do not use backticks (i.e. \`) in the code examples, stick to single or double quotes.
		If the answer contains code, please provide a single statement using markdown for the answer, do not break the answer up over multiple lines.</s> 
		<|user|>${prompt}</s>`;

	fetchResponse = async (
		prompt: string,
		options?: OllamaModelOptions
	): Promise<Response> =>
		fetch(new URL(`${this.baseUrl}/api/generate`), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept-Encoding": "gzip, deflate, br",
			},
			body: JSON.stringify({
				model: this.model,
				prompt,
				stream: !!options?.stream,
				options: {
					temperature: options?.temperature ?? 0.8,
					top_k: options?.k ?? 50,
					top_p: options?.p ?? 0.2,
					stop: options?.additionalStopTokens
						? [
								...options.additionalStopTokens,
								...defaultStopTokens,
						  ]
						: defaultStopTokens,
				},
			}),
		});

	stream = async (
		prompt: string,
		options?: OllamaModelOptions
	): Promise<Response> => this.fetchResponse(prompt, options);

	execute = async (
		prompt: string,
		options?: OllamaModelOptions
	): Promise<ModelResponse> =>
		this.fetchResponse(prompt, options ?? { stream: false }).then(
			(res) => res.json() as Promise<ModelResponse>
		);
}
