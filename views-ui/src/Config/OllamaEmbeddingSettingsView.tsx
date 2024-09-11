import { OllamaEmbeddingSettingsType } from "@shared/types/Settings";
import { Container, VSCodeTextField } from "./Config.styles";

type OllamaEmbeddingSection = OllamaEmbeddingSettingsType & {
	onChange: (ollamaSettings: OllamaEmbeddingSettingsType) => void;
};

export const OllamaEmbeddingSettingsView = ({
	dimensions,
	embeddingModel,
	baseUrl,
	onChange,
}: OllamaEmbeddingSection) => {
	const paths = { dimensions, embeddingModel, baseUrl };
	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const clone = { ...paths };
		//@ts-ignore
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
		</Container>
	);
};
