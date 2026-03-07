import { ToolMessage } from "@langchain/core/messages";
import { Command, isCommand } from "@langchain/langgraph";
import { MIDDLEWARE_BRAND, type AgentMiddleware } from "langchain";

const DEFAULT_TOOL_TOKEN_LIMIT_BEFORE_EVICT = 20_000;
const NUM_CHARS_PER_TOKEN = 4;
const MAX_PREVIEW_LINE_CHARS = 1_000;
const PREVIEW_HEAD_LINES = 5;
const PREVIEW_TAIL_LINES = 5;
const LARGE_TOOL_RESULTS_DIR = "/large_tool_results";

const DEFAULT_EXCLUDED_TOOLS = new Set([
	"ls",
	"glob",
	"grep",
	"read_file",
	"edit_file",
	"write_file",
	"execute",
]);

type ToolResultWriteResult = {
	error?: string;
	path?: string;
	filesUpdate?: Record<string, unknown> | null;
};

type ToolResultBackend = {
	write: (
		filePath: string,
		content: string,
	) => Promise<ToolResultWriteResult> | ToolResultWriteResult;
};

type LargeToolResultsMiddlewareOptions = {
	backend: () => ToolResultBackend;
	toolTokenLimitBeforeEvict?: number;
	excludedTools?: Iterable<string>;
};

type ToolMessageProcessResult = {
	message: ToolMessage;
	filesUpdate: Record<string, unknown> | null;
	changed: boolean;
};

const sanitizeToolCallId = (toolCallId: string): string =>
	toolCallId.replace(/\./g, "_").replace(/\//g, "_").replace(/\\/g, "_");

const formatContentWithLineNumbers = (
	lines: string[],
	startLine = 1,
): string => {
	return lines
		.map((line, index) => `${String(startLine + index).padStart(4, " ")} | ${line}`)
		.join("\n");
};

const createContentPreview = (
	content: string,
	headLines = PREVIEW_HEAD_LINES,
	tailLines = PREVIEW_TAIL_LINES,
): string => {
	const lines = content.split("\n");
	if (lines.length <= headLines + tailLines) {
		return formatContentWithLineNumbers(
			lines.map((line) => line.slice(0, MAX_PREVIEW_LINE_CHARS)),
		);
	}

	const head = lines
		.slice(0, headLines)
		.map((line) => line.slice(0, MAX_PREVIEW_LINE_CHARS));
	const tail = lines
		.slice(-tailLines)
		.map((line) => line.slice(0, MAX_PREVIEW_LINE_CHARS));

	return [
		formatContentWithLineNumbers(head, 1),
		`... [${lines.length - headLines - tailLines} lines truncated] ...`,
		formatContentWithLineNumbers(tail, lines.length - tailLines + 1),
	].join("\n");
};

const serializeToolContent = (
	content: unknown,
): { serialized: string; extension: string } | null => {
	if (typeof content === "string") {
		return { serialized: content, extension: ".txt" };
	}

	if (
		content === null ||
		content === undefined ||
		typeof content === "number" ||
		typeof content === "boolean" ||
		typeof content === "bigint"
	) {
		return { serialized: String(content), extension: ".txt" };
	}

	try {
		return {
			serialized: JSON.stringify(content, null, 2),
			extension: ".json",
		};
	} catch {
		return null;
	}
};

const buildEvictedMessage = (params: {
	toolCallId: string;
	filePath?: string;
	contentPreview: string;
	writeError?: string;
}) => {
	if (!params.filePath) {
		return [
			`Tool result too large. Wingman replaced the full output for tool call ${params.toolCallId} with a preview to keep the model context safe.`,
			params.writeError
				? `The full output could not be persisted to the agent filesystem: ${params.writeError}`
				: null,
			"Preview:",
			params.contentPreview,
		]
			.filter(Boolean)
			.join("\n\n");
	}

	return [
		`Tool result too large. The full output for tool call ${params.toolCallId} was saved to ${params.filePath}.`,
		"Use read_file with pagination to inspect it safely, for example offset=0 and limit=100.",
		"Preview:",
		params.contentPreview,
	].join("\n\n");
};

const createToolMessageReplacement = (
	message: ToolMessage,
	content: string,
): ToolMessage => {
	return new ToolMessage({
		content,
		tool_call_id: message.tool_call_id,
		name: message.name,
		id: message.id,
		artifact: message.artifact,
		status: message.status,
		metadata: message.metadata,
		additional_kwargs: message.additional_kwargs,
		response_metadata: message.response_metadata,
	});
};

const processToolMessage = async (
	message: ToolMessage,
	request: { toolCall?: { id?: string; name?: string } },
	backend: ToolResultBackend,
	maxCharsBeforeEvict: number,
	excludedTools: Set<string>,
): Promise<ToolMessageProcessResult> => {
	const toolName = request.toolCall?.name || message.name;
	if (toolName && excludedTools.has(toolName)) {
		return { message, filesUpdate: null, changed: false };
	}

	const serialized = serializeToolContent(message.content);
	if (!serialized || serialized.serialized.length <= maxCharsBeforeEvict) {
		return { message, filesUpdate: null, changed: false };
	}

	const toolCallId =
		request.toolCall?.id ||
		message.tool_call_id ||
		`${toolName || "tool"}_${Date.now()}`;
	const safeToolCallId = sanitizeToolCallId(toolCallId);
	const targetPath = `${LARGE_TOOL_RESULTS_DIR}/${safeToolCallId}${serialized.extension}`;
	const preview = createContentPreview(serialized.serialized);

	try {
		const writeResult = await backend.write(targetPath, serialized.serialized);
		const replacement = createToolMessageReplacement(
			message,
			buildEvictedMessage({
				toolCallId,
				filePath: writeResult.error ? undefined : writeResult.path || targetPath,
				contentPreview: preview,
				writeError: writeResult.error,
			}),
		);
		return {
			message: replacement,
			filesUpdate: writeResult.error ? null : (writeResult.filesUpdate ?? null),
			changed: true,
		};
	} catch (error) {
		return {
			message: createToolMessageReplacement(
				message,
				buildEvictedMessage({
					toolCallId,
					contentPreview: preview,
					writeError: error instanceof Error ? error.message : String(error),
				}),
			),
			filesUpdate: null,
			changed: true,
		};
	}
};

export const createLargeToolResultsMiddleware = (
	options: LargeToolResultsMiddlewareOptions,
): AgentMiddleware => {
	const maxCharsBeforeEvict =
		(options.toolTokenLimitBeforeEvict ??
			DEFAULT_TOOL_TOKEN_LIMIT_BEFORE_EVICT) * NUM_CHARS_PER_TOKEN;
	const excludedTools = new Set(options.excludedTools ?? DEFAULT_EXCLUDED_TOOLS);

	return {
		name: "large-tool-results-middleware",
		[MIDDLEWARE_BRAND]: true,
		wrapToolCall: async (request, handler) => {
			const result = await handler(request);

			if (maxCharsBeforeEvict <= 0) {
				return result;
			}

			const backend = options.backend();

			if (ToolMessage.isInstance(result)) {
				const processed = await processToolMessage(
					result,
					request,
					backend,
					maxCharsBeforeEvict,
					excludedTools,
				);
				if (processed.filesUpdate) {
					return new Command({
						update: {
							files: processed.filesUpdate,
							messages: [processed.message],
						},
					});
				}
				return processed.message;
			}

			if (!isCommand(result)) {
				return result;
			}

			const update = result.update as
				| { files?: Record<string, unknown>; messages?: unknown[] }
				| undefined;
			if (!update?.messages || !Array.isArray(update.messages)) {
				return result;
			}

			let changed = false;
			const processedMessages: unknown[] = [];
			let mergedFiles = update.files ? { ...update.files } : undefined;

			for (const message of update.messages) {
				if (!ToolMessage.isInstance(message)) {
					processedMessages.push(message);
					continue;
				}

				const processed = await processToolMessage(
					message,
					request,
					backend,
					maxCharsBeforeEvict,
					excludedTools,
				);
				processedMessages.push(processed.message);
				if (processed.changed) {
					changed = true;
				}
				if (processed.filesUpdate) {
					mergedFiles = {
						...(mergedFiles ?? {}),
						...processed.filesUpdate,
					};
				}
			}

			if (!changed) {
				return result;
			}

			return new Command({
				update: {
					...update,
					messages: processedMessages,
					...(mergedFiles ? { files: mergedFiles } : {}),
				},
			});
		},
	};
};
