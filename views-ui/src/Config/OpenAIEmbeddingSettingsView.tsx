import { OpenAIEmbeddingSettingsType } from "@shared/types/Settings";
import { Container, VSCodeTextField } from "./Config.styles";

type OpenAIEmbeddingSection = OpenAIEmbeddingSettingsType & {
	onChange: (openAISettings: OpenAIEmbeddingSettingsType) => void;
};

export const OpenAIEmbeddingSettingsView = ({
	dimensions,
	embeddingModel,
	apiKey,
	onChange,
}: OpenAIEmbeddingSection) => {
	const paths = { dimensions, embeddingModel, apiKey };
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
				value={dimensions}
				data-name="dimensions"
				title="The dimensions for the embedding model"
			>
				Dimensions:
			</VSCodeTextField>
			<VSCodeTextField
				onChange={handleChangeInput}
				value={apiKey}
				data-name="apiKey"
				title="OpenAI api key"
			>
				Api key:
			</VSCodeTextField>
		</Container>
	);
};
