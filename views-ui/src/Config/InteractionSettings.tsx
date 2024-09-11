import {
	VSCodeButton,
	VSCodeDropdown,
	VSCodeOption,
} from "@vscode/webview-ui-toolkit/react";
import { useState } from "react";
import { Settings } from "@shared/types/Settings";
import {
	ActionPanel,
	Container,
	DropDownContainer,
	VSCodeTextField,
} from "./Config.styles";
import { vscode } from "./utilities/vscode";

type InteractionSettings = Required<Settings>["interactionSettings"];
const tooltipInformation = {
	completion:
		"Enable this setting activates code completion. Code completion will run when you type in a file for a supported language.",
	streaming:
		"Enabling this setting activates code streaming for code completion, prioritizing faster code completion results over detailed suggestions by providing shorter responses.",
	ccw: "Adjust the context window size to determine the amount of context included in code completion. Starting with a lower value (e.g., 128) is recommended, increasing as needed for better performance on more powerful setups.",
	cmt: "Controls the maximum number of tokens returned by code completion. Here we recommend starting low at 128.",
	chcw: "Adjust the context window size to determine the amount of context included in chat request. We start this at 4096, depending on the LLM you use it can be increased.",
	chmt: "Controls the maximum number of tokens returned by the chat request. Here we also start at 4096.",
};
export const InteractionSettings = (interactions: InteractionSettings) => {
	const [currentInteractions, setInteractions] = useState(interactions);

	const handleCompletionChange = (e: any) => {
		const clone = { ...currentInteractions };
		if (e.target.value === "true") {
			clone.codeCompletionEnabled = true;
		} else if (e.target.value === "false") {
			clone.codeCompletionEnabled = false;
		}
		setInteractions(clone);
	};

	const handleStreamChange = (e: any) => {
		const clone = { ...currentInteractions };
		if (e.target.value === "true") {
			clone.codeStreaming = true;
		} else if (e.target.value === "false") {
			clone.codeStreaming = false;
		}
		setInteractions(clone);
	};

	const handleChange = (e: any) => {
		const number = Number(e.target.value);
		if (!number) return;
		const field = e.target.getAttribute("data-name");
		const clone = { ...currentInteractions };
		//@ts-ignore
		clone[field] = number;
		setInteractions(clone);
	};

	const handleClick = () => {
		vscode.postMessage({
			command: "changeInteractions",
			value: currentInteractions,
		});
	};

	const reset = () => {
		setInteractions({ ...interactions });
	};

	return (
		<Container>
			<DropDownContainer>
				<label htmlFor="code-streaming">Code Completion enabled:</label>
				<VSCodeDropdown
					title={tooltipInformation.completion}
					id="code-completion"
					data-name="codeCompletionEnabled"
					onChange={handleCompletionChange}
					value={currentInteractions.codeCompletionEnabled.toString()}
					style={{ minWidth: "200px" }}
				>
					<VSCodeOption>true</VSCodeOption>
					<VSCodeOption>false</VSCodeOption>
				</VSCodeDropdown>
			</DropDownContainer>
			<DropDownContainer>
				<label htmlFor="code-streaming">Code streaming:</label>
				<VSCodeDropdown
					title={tooltipInformation.streaming}
					id="code-streaming"
					data-name="codeStreaming"
					onChange={handleStreamChange}
					value={currentInteractions.codeStreaming.toString()}
					style={{ minWidth: "200px" }}
				>
					<VSCodeOption>true</VSCodeOption>
					<VSCodeOption>false</VSCodeOption>
				</VSCodeDropdown>
			</DropDownContainer>
			<VSCodeTextField
				title={tooltipInformation.ccw}
				data-name="codeContextWindow"
				value={currentInteractions.codeContextWindow.toString()}
				onChange={handleChange}
			>
				Code Context Window
			</VSCodeTextField>

			<VSCodeTextField
				title={tooltipInformation.cmt}
				data-name="codeMaxTokens"
				value={currentInteractions.codeMaxTokens.toString()}
				onChange={handleChange}
			>
				Code Max Tokens
			</VSCodeTextField>

			<VSCodeTextField
				title={tooltipInformation.chcw}
				data-name="chatContextWindow"
				value={currentInteractions.chatContextWindow.toString()}
				onChange={handleChange}
			>
				Chat Context Window
			</VSCodeTextField>

			<VSCodeTextField
				title={tooltipInformation.chmt}
				data-name="chatMaxTokens"
				value={currentInteractions.chatMaxTokens.toString()}
				onChange={handleChange}
			>
				Chat Max Tokens
			</VSCodeTextField>
			<ActionPanel>
				<VSCodeButton onClick={handleClick}>Save</VSCodeButton>
				<VSCodeButton appearance="secondary" onClick={reset}>
					Cancel
				</VSCodeButton>
			</ActionPanel>
		</Container>
	);
};
