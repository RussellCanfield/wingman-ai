import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatAnthropic } from "@langchain/anthropic";

export type AnalyzerResult = z.infer<typeof analyzerResult>;

const analyzerResult = z.object({
	files: z
		.array(
			z.object({
				analysis: z.string(),
				file: z.string(),
			})
		)
		.describe("The list of files and their analysis"),
	refinementQuestions: z.array(z.string()),
});

const schema = zodToJsonSchema(analyzerResult);
const codeAnalyzerFunction = {
	name: "code-analyzer",
	description:
		"This tool is used to analyze source code and determine a plan of action.",
	parameters: schema,
};

const codeAnalyzerTool = {
	type: "function",
	function: codeAnalyzerFunction,
};

const analyzerPrompt = ChatPromptTemplate.fromTemplate(
	`You are an expert software engineer planning to implement a feature in a project.

For the given objective:

1. Develop a detailed, comprehensive, step-by-step plan of action to accomplish the objective.
2. Analyze the provided code files and determine which are directly relevant to the task.
3. For each relevant file, provide a brief analysis of how it relates to the objective and what changes or additions are needed.
4. Ensure the proposed solution aligns with existing code's language and style.
5. Be sure to consider the project details and objective requirements.
6. State any additional questions about the code or solution that may aid you in refining the solution in a subsequent step.
7. Focus on high-level planning; implementation details can be figured out in the next step.

Project Details:

{details}

----

{objective}

----

Here are a list of steps from your previous refinement session, related to the objective and code files:

{plan}

----

Take a deep breath and think through the problem step by step.
Carefully review the following code files, which represent the current state of the project.
Only include files in your response that are directly related to the task at hand. Omit any files that are not relevant to the objective.
If new files need to be created, follow the existing file path structure and include them in your response.
Provide a concise analysis and implementation plan for each relevant file.

For each relevant file, use the following format:

file: "[file path]"
relevance: "[Brief explanation of why this file is relevant]"
analysis: "[Concise analysis of required changes or additions]"

----

{documents}`
);

// async function analyzerStep(
//   state: PlanExecuteState
// ): Promise<Partial<PlanExecuteState>> {
//   const projectDetails = new ProjectDetailsHandler(workspace, undefined);
//   const details = await projectDetails.retrieveProjectDetails();
//   let objective = `Objective, these are the original requirements in conversation form containing any refinement that may have occurred:
//   ${formatMessages(state.messages)}

//   ----

//   Initial thoughts on implementation:

//   ${state.plan?.steps.join("\n")}`;

//   if (state.followUpInstructions.length > 0) {
//     objective = `In a previous session with the user, you were provided with the following instructions/requirements, but you have already performed this work:

// ${formatMessages(state.messages)}

// ----

// The user has provided follow up instructions for the work you've already done, use these to refine the code you've already written or modified:

// ${formatMessages(state.followUpInstructions)}`;
//   }

//   let updatedFiles = state.files || [];
//   const codeDocuments =
//     state.files?.map(
//       (f) => `File:
// ${f.file}

// Code:
// ${f.code}`
//     ) || [];

//   const result = (await codeAnalyzer.invoke({
//     details: details?.description || "Not available.",
//     plan: state.plan?.steps.join("\n") || "",
//     objective: `${objective}

// ----

// During your initial refinement, you suggested starting with these steps:

// ${state.plan?.steps.join("\n")}`,
//     documents: codeDocuments.join("\n\n"),
//   })) as AnalyzerResult;

//   if (result.refinementQuestions.length > 0) {
//     const vectorQuery = new VectorQuery();

//     for (const question of result.refinementQuestions) {
//       // TODO - Loop through each question and get docs.
//       const relatedCodeDocs =
//         await vectorQuery.retrieveDocumentsWithRelatedCodeFiles(
//           question,
//           codeGraph,
//           store,
//           workspace,
//           10
//         );
//       updatedFiles = updatedFiles.concat(
//         Array.from(relatedCodeDocs.entries()).map(([k, v]) => ({
//           file: k,
//           code: v.getText(),
//         }))
//       );
//     }
//   }

//   const uniqueFiles = new Set<string>();

//   result.files.forEach((file) => {
//     const existingFile = updatedFiles.find((f) => f.file === file.file);
//     if (existingFile) {
//       existingFile.analysis = file.analysis;
//     } else {
//       updatedFiles.push(file);
//     }
//   });

//   // Remove duplicates from updatedFiles
//   const deduplicatedFiles = updatedFiles.filter((file) => {
//     if (uniqueFiles.has(file.file)) {
//       return false;
//     } else {
//       uniqueFiles.add(file.file);
//       return true;
//     }
//   });

//   updatedFiles = deduplicatedFiles;

//   return {
//     files: updatedFiles,
//   };
// }

export const createCodeAnalyzerTool = (chatModel: BaseChatModel) => {
	const model = chatModel.withStructuredOutput(codeAnalyzerFunction);
	return {
		model,
		codeAnalyzer: analyzerPrompt.pipe(model),
	};
};

export { codeAnalyzerTool };
