import { createRequire } from "module";
import url from "url";

const require = createRequire(import.meta.url);

export async function getPrebuildBinPath() {
	function createPath(platform: string, arch: string) {
		return `${platform}-${arch}/llama-addon.node`;
	}

	async function getPath() {
		switch (process.platform) {
			case "win32":
			case "cygwin":
				return createPath("win", process.arch);
			case "linux":
			case "android":
				return createPath("linux", process.arch);
			case "darwin":
				return createPath("mac", process.arch);
		}
		return null;
	}
	return await getPath();
}

export async function loadBin(path: string): Promise<LlamaCppNodeModule> {
	const fileUrl = new URL(path);
	const filePath = url.fileURLToPath(fileUrl);

	const prebuiltBinPath = await getPrebuildBinPath();

	return require(`${filePath}/${prebuiltBinPath}`);
}

export type LlamaCppNodeModule = {
	LLAMAModel: LLAMAModel;
	LLAMAContext: LLAMAContext;
	LLAMAGrammar: LLAMAGrammar;
	LLAMAGrammarEvaluationState: LLAMAGrammarEvaluationState;
	systemInfo(): string;
};

export type LLAMAModel = {
	new (
		modelPath: string,
		params: {
			gpuLayers?: number;
			vocabOnly?: boolean;
			useMmap?: boolean;
			useMlock?: boolean;
		}
	): LLAMAModel;
};

export type LLAMAContext = {
	new (
		model: LLAMAModel,
		params: {
			seed?: number;
			contextSize?: number;
			batchSize?: number;
			f16Kv?: boolean;
			logitsAll?: boolean;
			embedding?: boolean;
			threads?: number;
		}
	): LLAMAContext;
	encode(text: string): Uint32Array;
	eval(
		tokens: Uint32Array,
		options?: {
			temperature?: number;
			topK?: number;
			topP?: number;
			repeatPenalty?: number;
			repeatPenaltyTokens?: Uint32Array;
			repeatPenaltyPresencePenalty?: number; // alpha_presence
			repeatPenaltyFrequencyPenalty?: number; // alpha_frequency
			grammarEvaluationState?: LLAMAGrammarEvaluationState;
		}
	): Promise<number>;
	decode(tokens: Uint32Array): string;
	tokenBos(): number;
	tokenEos(): number;
	tokenNl(): number;
	getContextSize(): number;
	getTokenString(token: number): string;
};

export type LLAMAGrammar = {
	new (
		grammarPath: string,
		params?: {
			printGrammar?: boolean;
		}
	): LLAMAGrammar;
};

export type LLAMAGrammarEvaluationState = {
	new (grammar: LLAMAGrammar): LLAMAGrammarEvaluationState;
};
