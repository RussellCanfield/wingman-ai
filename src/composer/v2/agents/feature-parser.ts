// import { BaseChatModel } from "@langchain/core/language_models/chat_models";
// import { PlanExecuteState } from "../types";
// import {
// 	ChatMessage,
// 	HumanMessage,
// 	MessageContentText,
// } from "@langchain/core/messages";
// import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
// import { AIProvider } from "../../../service/base";

// type BuildPromptParams = {
// 	projectDetails?: string;
// 	taskSummary: string;
// 	modifiedFiles: string;
// 	availabileFiles: string[]
// }

// const featureParserPrompt = `You are a senior fullstack developer helping implement features efficiently.
// You will not be writing code, instead you are analyzing and planning the next task of implementing a feature.
// Analyze the implementation plan against the files recently changed to determine if there are gaps.

// **Rules**
// - Do not provide any code to the user
// - Avoid mentioning creating directories
// - Begin your response in a casual tone, do not mention the context
// - Do not include any notes or additional content outside of what is suggested in the response example
// - Ensure all files are created, and features are implemented fully

// Project Details:
// {{projectDetails}}

// Implementation Plan:
// {{taskSummary}}

// Recently Changed Files:
// {{modifiedFiles}}

// Available workspace files:
// {{availableFiles}}

// ---

// Response example:
// Now that we've completed [summary of the request], let's continue working on this feature. Here's what I recommend:

// ### Next Steps
// [1-2 specific, actionable tasks]

// Would you like to proceed?`;

// export class FeatureParser {

// 	constructor(
// 		private readonly aiProvider: AIProvider,
// 		private readonly workspace: string
// 	) { }

// 	parseFeature = async (state: PlanExecuteState) => {
// 		const msgs: Array<MessageContentText> = [
// 			{
// 				type: "text",
// 				text: buildPrompt({
// 					projectDetails: state.projectDetails || "Not available.",
// 					modifiedFiles: state.files?.length === 0 ? "" :
// 						state.files!.map(f =>
// 							`File: ${f.path}\nChanges: ${f.description}`
// 						).join(`\n`),
// 					taskSummary: state.userIntent?.task || "None provided.",
// 					availabileFiles: state.scannedFiles?.filter(f => f.type === "file").map(f => f.path) ?? []
// 				}),
// 			}
// 		];

// 		let output = '';
// 		for await (const chunk of await this.model.stream([
// 			new HumanMessage({
// 				content: msgs
// 			})
// 		])) {
// 			output += chunk.content.toString();
// 			await dispatchCustomEvent("composer-message-stream", output);
// 		}

// 		const messages = [...state.messages, new ChatMessage(output, "assistant")];

// 		await dispatchCustomEvent("composer-message-stream-finish", {
// 			messages
// 		} satisfies Partial<PlanExecuteState>);

// 		return {
// 			messages
// 		} satisfies Partial<PlanExecuteState>
// 	}
// }