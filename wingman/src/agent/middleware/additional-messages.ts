import {
	HumanMessage,
	MIDDLEWARE_BRAND,
	type AgentMiddleware,
	type BaseMessage,
} from "langchain";
import { getMachineDetails } from "../utils";
import {
	loadUiRegistry,
	resolveUiRegistryPath,
	summarizeUiRegistry,
} from "../uiRegistry.js";

type AdditionalMessageContext = {
	workspaceRoot?: string | null;
	workdir?: string | null;
	defaultOutputDir?: string | null;
	dynamicUiEnabled?: boolean;
	skillsDirectory?: string;
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
			const alreadyInjected = input.messages.some(
				(message) =>
					(message as { additional_kwargs?: { source?: string } })
						?.additional_kwargs?.source === "additional-message-middleware",
			);

			if (alreadyInjected) {
				return input;
			}

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

			if (context.dynamicUiEnabled === false) {
				lines.push(
					"** Dynamic UI **\n" +
						"- Dynamic UI rendering is disabled for this gateway.\n" +
						"- Respond with plain text and avoid calling UI presentation tools.",
				);
			} else {
				const skillsDir = context.skillsDirectory || "skills";
				const resolution = await resolveUiRegistryPath(
					context.workspaceRoot || process.cwd(),
					skillsDir,
				);
				const registry = resolution
					? await loadUiRegistry(resolution.path)
					: null;
				if (registry) {
					const summary = summarizeUiRegistry(registry);
					const summaryLines =
						summary.length > 0
							? summary.join("\n")
							: "- (no UI components registered)";
					lines.push(
						"** Dynamic UI Registry **\n" +
							summaryLines +
							"\n- Use ui_registry_get for schema details, then ui_present with textFallback.",
					);
				}
			}

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
