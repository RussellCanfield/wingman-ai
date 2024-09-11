import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

const schema = zodToJsonSchema(
	z.object({
		files: z.array(
			z.object({
				file: z.string(),
				review: z.string(),
			})
		),
		overview: z
			.string()
			.describe(
				"A high-level overview of if the code meets the objective and requirements."
			),
	})
);
const codeReviewerFunction = {
	name: "code-reviewer",
	description:
		"This tool is used to review modifications to, or new source code.",
	parameters: schema,
};

const codeReviewerTool = {
	type: "function",
	function: codeReviewerFunction,
};

const reviewerPrompt = ChatPromptTemplate.fromTemplate(
	`You're an expert software engineer. Review the code based on the objective and analysis provided. Your review should:

1. Examine the code and the changes thoroughly, noting potential issues or improvements.
2. Verify implementation accuracy and alignment with objective and requirements.
3. Assess:
   - Code cleanliness and completeness
   - Objective fulfillment
   - Implementation correctness
   - Import statement paths
   - Extraneous changes
   - If all code has been written, validate import statements and that all files have been modified or created.
4. Code will be in GitHub flavored markdown format, if it is now please note it so it can be corrected.
5. Use the refinement questions and plan to guide your review.
6. Where any questions left unanswered? Any code not implemented?

Reference the objective (including refinements) and analysis. Highlight strengths and areas for improvement.

Objective, these are the original requirements in conversation form containing any refinement that may have occurred:

{objective}

----

Use the following high level plan as a guide for your review.
The general code changes should have adhered to this plan.

{plan}

-----

Follow up instructions, these are questions or instructions from the user to refine a solution you've already provided.
Favor these instructions to refine the code you've already written or modified:

{refinement}

----

File to review:

{files}`
);

export const createCodeReviewingTool = (chatModel: BaseChatModel) => {
	const model = chatModel.withStructuredOutput(codeReviewerFunction);
	return {
		model,
		codeReviewer: reviewerPrompt.pipe(model),
	};
};

export { codeReviewerTool };
