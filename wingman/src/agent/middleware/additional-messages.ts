import {
	HumanMessage,
	MIDDLEWARE_BRAND,
	type AgentMiddleware,
	type BaseMessage,
} from "langchain";
import { getMachineDetails } from "../utils";

type AdditionalMessageContext = {
	workdir?: string | null;
	defaultOutputDir?: string | null;
};

export const additionalMessageMiddleware = (
	context: AdditionalMessageContext = {},
): AgentMiddleware => {
	return {
		name: "additional-message-middleware",
		[MIDDLEWARE_BRAND]: true,
		beforeAgent: async (input: {
			messages: BaseMessage[];
		}): Promise<{
			messages: BaseMessage[];
		}> => {
			const lines = [
				getMachineDetails(),
				`** Current Date Time (UTC): ${new Date().toISOString()} **`,
			];

			if (context.workdir) {
				lines.push(`** Working directory for outputs: ${context.workdir} **`);
			} else if (context.defaultOutputDir) {
				lines.push(
					`** No session working directory set. Default output directory: ${context.defaultOutputDir} **`,
				);
			}

			lines.push(
				"** Long-term memory **\n" +
					"- Use /memories/ for durable notes across threads.\n" +
					"- Store stable preferences, project context, decisions, and research notes.\n" +
					"- Avoid transient logs; keep entries concise and organized.\n" +
					"- Suggested paths: /memories/preferences.md, /memories/projects/<name>/context.md, /memories/projects/<name>/decisions.md",
			);

			input.messages.unshift(
				new HumanMessage({
					content: lines.join("\n\n"),
					additional_kwargs: {
						ui_hidden: true,
						source: "additional-message-middleware",
					},
				}),
			);
			return input;
		},
	};
};
