import { OllamaEmbeddingSettingsType } from "@shared/types/Settings";
import { Container, VSCodeTextField } from "./Config";
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react";

type OllamaEmbeddingSection = OllamaEmbeddingSettingsType & {
	onChange: (ollamaSettings: OllamaEmbeddingSettingsType) => void;
};

export const OllamaEmbeddingSettingsView = ({
	dimensions,
	embeddingModel,
	baseUrl,
	enabled,
	onChange,
}: OllamaEmbeddingSection) => {
	const paths = { dimensions, embeddingModel, baseUrl, enabled };
	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const clone = { ...paths };
		//@ts-expect-error
		clone[field] = e.target.value;
		onChange(clone);
	};

	return (
		<Container>
			<VSCodeTextField
				onChange={handleChangeInput}
				value={embeddingModel}
				data-name="embeddingModel"
				title="Embedding model"
			>
				Embedding model:
			</VSCodeTextField>
			<VSCodeTextField
				onChange={handleChangeInput}
				value={baseUrl}
				data-name="baseUrl"
				title="Ollama's base path"
			>
				Base url:
			</VSCodeTextField>
			<VSCodeTextField
				onChange={handleChangeInput}
				value={dimensions}
				data-name="dimensions"
				title="The dimensions for the embedding model"
			>
				Dimensions:
			</VSCodeTextField>
			<div className="flex gap-2 items-center">
				<p>Enabled:</p>
				<VSCodeCheckbox
					value={enabled ? "true" : "false"}
					data-name="enabled"
					title="Enable Ollama Embeddings"
				/>
			</div>
		</Container>
	);
};
