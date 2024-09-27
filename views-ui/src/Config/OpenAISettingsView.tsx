import { ApiSettingsType } from "@shared/types/Settings";
import { InitSettings } from "./App";
import { Container, VSCodeTextField } from "./Config";

type OpenAiSection = InitSettings["providerSettings"]["OpenAI"] & {
	onChange: (ollamaSettings: ApiSettingsType) => void;
};
export const OpenAISettingsView = ({
	codeModel,
	chatModel,
	baseUrl,
	apiKey,
	onChange,
}: OpenAiSection) => {
	const paths = { codeModel, chatModel, baseUrl, apiKey };
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
				value={codeModel}
				data-name="codeModel"
				title="OpenAI Code Model"
			>
				Code Model:
			</VSCodeTextField>
			<VSCodeTextField
				onChange={handleChangeInput}
				value={chatModel}
				data-name="chatModel"
				title="OpenAI Chat Model"
			>
				Chat Model:
			</VSCodeTextField>
			<VSCodeTextField
				onChange={handleChangeInput}
				value={baseUrl}
				data-name="baseUrl"
				title="OpenAI base url"
			>
				Base url:
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
