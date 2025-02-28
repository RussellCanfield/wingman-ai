import { tool } from "@langchain/core/tools";
import type { MCPToolConfig } from "@shared/types/Settings";
import { EventSourcePolyfill } from "event-source-polyfill";
import type { HeadersInit } from "node-fetch";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

// Execute command as a promise
const execPromise = promisify(exec);

// Schema for tool input
const mcpToolSchema = z.object({
	query: z.string().describe("The query to send to the MCP tool"),
	options: z
		.object({
			additionalParams: z
				.record(z.any())
				.optional()
				.describe("Additional parameters to pass to the MCP tool"),
		})
		.optional()
		.describe("Optional configuration for the MCP tool request"),
});

// Input and output types
type MCPToolInput = z.infer<typeof mcpToolSchema>;

/**
 * Format input for MCP API
 */
const formatInputForMCP = (
	query: string,
	version: string,
	additionalParams?: Record<string, any>,
): any => {
	return {
		query,
		options: {
			version,
			...(additionalParams || {}),
		},
	};
};

/**
 * Transform MCP response for LangChain
 */
const transformResponseForLangChain = (mcpResponse: any): string => {
	if (typeof mcpResponse === "object") {
		return JSON.stringify(mcpResponse);
	}
	return mcpResponse.toString();
};

/**
 * Send request to MCP endpoint (REST API)
 */
const sendToMCPEndpoint = async (
	data: any,
	config: MCPToolConfig,
): Promise<any> => {
	if (!config.endpoint) {
		throw new Error("Endpoint is required for SSE type MCP tools");
	}

	const headers: HeadersInit = {
		"Content-Type": "application/json",
	};

	const response = await fetch(config.endpoint, {
		method: "POST",
		headers,
		body: JSON.stringify(data),
	});

	if (!response.ok) {
		throw new Error(`MCP request failed with status: ${response.status}`);
	}

	return response.json();
};

/**
 * Handle SSE connection to MCP endpoint
 */
const handleSSEConnection = async (
	data: any,
	config: MCPToolConfig,
): Promise<string> => {
	if (!config.endpoint) {
		throw new Error("Endpoint is required for SSE type MCP tools");
	}

	return new Promise((resolve, reject) => {
		let result = "";

		// Create query params from data
		const params = new URLSearchParams();
		if (data.query) params.append("query", data.query);
		if (data.options?.version) params.append("version", data.options.version);

		// Add additional params if they exist
		if (data.options?.additionalParams) {
			// biome-ignore lint/complexity/noForEach: <explanation>
			Object.entries(data.options.additionalParams).forEach(([key, value]) => {
				params.append(key, String(value));
			});
		}

		// Create URL with query params
		const url = `${config.endpoint}?${params.toString()}`;

		// Setup SSE connection
		const headers: Record<string, string> = {};

		const eventSource = new EventSourcePolyfill(url, { headers });

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				result += data.content || data.text || JSON.stringify(data);
			} catch (e) {
				// If not JSON, just append the data
				result += event.data;
			}
		};

		eventSource.onerror = (error) => {
			eventSource.close();
			reject(`SSE connection error: ${error}`);
		};

		eventSource.addEventListener("end", () => {
			eventSource.close();
			resolve(result);
		});

		// Fallback timeout to ensure the connection doesn't hang indefinitely
		setTimeout(() => {
			if (eventSource.readyState !== 2) {
				// 2 means CLOSED
				eventSource.close();
				resolve(result || "SSE connection timed out, partial result returned");
			}
		}, 30000); // 30 second timeout
	});
};

/**
 * Execute command line MCP tool
 */
const executeCommand = async (
	data: any,
	config: MCPToolConfig,
): Promise<string> => {
	if (!config.command) {
		throw new Error("Command is required for command type MCP tools");
	}

	// Replace placeholders in command with data
	let commandToRun = config.command;

	// Replace {query} with the actual query
	if (data.query) {
		commandToRun = commandToRun.replace(/\{query\}/g, data.query);
	}

	// Replace any additional parameter placeholders
	if (data.options?.additionalParams) {
		// biome-ignore lint/complexity/noForEach: <explanation>
		Object.entries(data.options.additionalParams).forEach(([key, value]) => {
			commandToRun = commandToRun.replace(
				new RegExp(`\\{${key}\\}`, "g"),
				String(value),
			);
		});
	}

	// Execute the command
	try {
		const { stdout, stderr } = await execPromise(commandToRun);
		if (stderr) {
			console.warn(`Command stderr: ${stderr}`);
		}
		return stdout;
	} catch (error) {
		throw new Error(`Command execution failed: ${error}`);
	}
};

/**
 * Create an MCP tool with the given configuration
 */
export const createMCPTool = (config: MCPToolConfig) => {
	return tool<MCPToolInput>(
		async (input: MCPToolInput) => {
			try {
				// Format request for MCP
				const formattedInput = formatInputForMCP(
					input.query,
					config.version,
					input.options?.additionalParams,
				);

				let response: any;

				// Handle different tool types
				if (config.type === "sse") {
					response = await handleSSEConnection(formattedInput, config);
				} else if (config.type === "command") {
					response = await executeCommand(formattedInput, config);
				} else {
					// Default to REST API for backward compatibility
					response = await sendToMCPEndpoint(formattedInput, config);
				}

				// Transform response
				return transformResponseForLangChain(response);
			} catch (error) {
				console.error("Error in MCP Tool:", error);
				return `Error using MCP tool ${config.name}: ${error}`;
			}
		},
		{
			name: config.name || "mcp_tool",
			description:
				config.description || "Tool for connecting with Model Context Protocol",
			//@ts-expect-error
			schema: mcpToolSchema,
		},
	);
};
