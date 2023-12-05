import { ReadableStream } from "stream/web";

export interface ModelOptions {
	temperature: number;
	model?: string;
}

export interface ModelResponse {
	response: string;
}

export type ModelStream = ReadableStream<Uint8Array> &
	AsyncIterable<Uint8Array>;

export interface BaseModel extends ModelOptions {
	getStream: (prompt: string) => Promise<ModelStream>;
	getResponse: (prompt: string) => Promise<ModelResponse>;
}

export interface OllamaModelOptions extends ModelOptions {
	baseUrl: string;
	k?: number;
	p?: number;
}

export class Ollama implements BaseModel {
	temperature: number;
	model?: string;
	baseUrl: string;
	k?: number;
	p?: number;

	constructor(options: OllamaModelOptions) {
		this.temperature = options.temperature ?? 0;
		this.model = options.model ?? "llama2";
		this.baseUrl = options.baseUrl ?? "http://localhost:11434";
		this.k = options.k ?? 20;
		this.p = options.p ?? 0.3;
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
		stream?: boolean
	): Promise<Response> =>
		await fetch(new URL(`${this.baseUrl}/api/generate`), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: this.model,
				prompt: this.withBasePrompt(prompt),
				stream: !!stream,
				temperature: this.temperature,
				options: {
					top_k: this.k,
					top_p: this.p,
				},
			}),
		});

	getStream = async (prompt: string): Promise<ModelStream> =>
		this.fetchResponse(prompt, true).then((res) => res.body as ModelStream);

	getResponse = async (prompt: string): Promise<ModelResponse> =>
		this.fetchResponse(prompt)
			.then((res) => res.json())
			.then((res) => res as ModelResponse);
}
