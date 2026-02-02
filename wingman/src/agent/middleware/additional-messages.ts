import { isAbsolute, relative } from "node:path";
import {
	HumanMessage,
	MIDDLEWARE_BRAND,
	type AgentMiddleware,
	type BaseMessage,
} from "langchain";
import { getConfidentialityNotice } from "../utils";
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

const normalizeRelativePath = (value: string): string =>
	value.replace(/\\/g, "/");

const toSafeRelativePath = (
	workspaceRoot: string | null | undefined,
	targetPath: string,
): string | null => {
	if (!workspaceRoot) return null;
	const rel = relative(workspaceRoot, targetPath);
	if (!rel || rel === ".") return ".";
	if (rel.startsWith("..") || isAbsolute(rel)) return null;
	const normalized = normalizeRelativePath(rel).replace(/^\.?\//, "");
	return `./${normalized}`;
};

const buildOutputLocationMessage = (
	context: AdditionalMessageContext,
): string | null => {
	const targetPath = context.workdir || context.defaultOutputDir;
	if (!targetPath) return null;

	const locationLabel = context.workdir
		? "session output directory"
		: "default output directory";
	const safePath = toSafeRelativePath(context.workspaceRoot, targetPath);
	const locationLine = safePath
		? `- Use the ${locationLabel}: ${safePath}`
		: `- Use the ${locationLabel} (path hidden).`;

	return [
		"** Output Location **",
		locationLine,
		"- If the user asks for a location, provide a relative path and avoid absolute paths or usernames.",
	].join("\n");
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
				getConfidentialityNotice(),
				`** Current Date Time (UTC): ${new Date().toISOString()} **`,
			];

			const outputLocation = buildOutputLocationMessage(context);
			if (outputLocation) {
				lines.push(outputLocation);
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
