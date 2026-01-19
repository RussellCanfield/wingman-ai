import {
	HumanMessage,
	MIDDLEWARE_BRAND,
	type AgentMiddleware,
	type BaseMessage,
} from "langchain";
import { getMachineDetails } from "../utils";

export const additionalMessageMiddleware = (): AgentMiddleware => {
	return {
		name: "additional-message-middleware",
		[MIDDLEWARE_BRAND]: true,
		beforeAgent: async (input: {
			messages: BaseMessage[];
		}): Promise<{
			messages: BaseMessage[];
		}> => {
			input.messages.unshift(
				new HumanMessage({
					content: `${getMachineDetails()}

** Current Date Time (UTC): ${new Date().toISOString()} **`,
				}),
			);
			return input;
		},
	};
};
