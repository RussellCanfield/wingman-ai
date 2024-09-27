import { OpenAIEmbeddingSettingsType } from "@shared/types/Settings";
import { Container, VSCodeTextField } from "./Config";
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react";

type OpenAIEmbeddingSection = OpenAIEmbeddingSettingsType & {
	onChange: (openAISettings: OpenAIEmbeddingSettingsType) => void;
};

export const OpenAIEmbeddingSettingsView = ({
	dimensions,
	embeddingModel,
	apiKey,
	enabled,
	onChange,
}: OpenAIEmbeddingSection) => {
	const paths = { dimensions, embeddingModel, apiKey, enabled };
	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const clone = { ...paths };
		//@ts-expect-error
		clone[field] = e.target.value;
		onChange(clone);
	};

	const handleCheckboxChange = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const clone = { ...paths };
		//@ts-expect-error
		clone[field] = e.target.checked;
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
			<div className="flex gap-2 items-center">
				<p>Enabled:</p>
				<VSCodeCheckbox
					checked={enabled}
					onChange={handleCheckboxChange}
					data-name="enabled"
					title="Enable OpenAI Embeddings"
				/>
			</div>
		</Container>
	);
};
