import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { OllamaSettingsType } from "../types/Settings";
import { InitSettings } from "./App";
import { Container, DropDownContainer, VSCodeTextField } from "./Config.styles";

type OllamaSection = InitSettings["ollama"] & {
	ollamaModels: string[];
	onChange: (ollamaSettings: OllamaSettingsType) => void;
};
export const OllamaSettingsView = ({
	codeModel,
	chatModel,
	ollamaModels,
	apiPath,
	modelInfoPath,
	baseUrl,
	onChange,
}: OllamaSection) => {
	const paths = { codeModel, chatModel, baseUrl, apiPath, modelInfoPath };
	const handleChange = (e: any) => {
		if (!ollamaModels.includes(e.target.value)) return;
		const clone = { ...paths };
		clone["codeModel"] = e.target.value;
		onChange(clone);
	};

	const handleChatChange = (e: any) => {
		if (!ollamaModels.includes(e.target.value)) return;
		const clone = { ...paths };
		clone["chatModel"] = e.target.value;
		onChange(clone);
	};

	const handleChangeInput = (e: any) => {
		const field = e.target.getAttribute("data-name");
		const clone = { ...paths };
		//@ts-ignore
		clone[field] = e.target.value;
		onChange(clone);
	};

	return (
		<Container>
			<DropDownContainer>
				<label htmlFor="code-model">Code model:</label>
				<VSCodeDropdown
					id="code-model"
					value={codeModel}
					onChange={handleChange}
					style={{ minWidth: "100%" }}
				>
					{ollamaModels.map((ab) => (
						<VSCodeOption key={ab}>{ab}</VSCodeOption>
					))}
				</VSCodeDropdown>
			</DropDownContainer>
			<DropDownContainer>
				<label htmlFor="chat-model">Chat model:</label>
				<VSCodeDropdown
					id="chat-model"
					value={chatModel}
					style={{ minWidth: "100%" }}
					onChange={handleChatChange}
				>
					{ollamaModels.map((ab) => (
						<VSCodeOption key={ab}>{ab}</VSCodeOption>
					))}
				</VSCodeDropdown>
			</DropDownContainer>
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
				value={apiPath}
				data-name="apiPath"
				title="Ollama's generation endpoint"
			>
				Api path:
			</VSCodeTextField>
			<VSCodeTextField
				onChange={handleChangeInput}
				value={modelInfoPath}
				data-name="modelInfoPath"
				title="Ollama's info path"
			>
				Model info path:
			</VSCodeTextField>
		</Container>
	);
};
