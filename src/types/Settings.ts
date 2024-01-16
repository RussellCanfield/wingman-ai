export interface Settings {
	aiProvider: string;
	ollama?: {
		chatModel: string;
		codeModel: string;
		baseUrl: string;
		apiPath: string;
		modelInfoPath: string;
	};
	huggingface?: {
		chatModel: string;
		codeModel: string;
		baseUrl: string;
		apiKey: string;
	};
}
