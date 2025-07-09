import { WingmanAgent, createLogger } from "../src/index";
import { ChatOpenAI } from "@langchain/openai";

/**
 * Example demonstrating different logging configurations for the Wingman Agent
 */

async function demonstrateLogging() {
	console.log("=== Wingman Agent Logger Examples ===\n");

	// Example 1: Silent mode (ideal for CLI tools)
	console.log("1. Silent Logger (CLI-friendly):");
	const silentAgent = new WingmanAgent({
		name: "Silent Agent",
		model: new ChatOpenAI({ model: "gpt-4" }),
		logger: createLogger('silent'),
		tools: ["read_file", "edit_file"]
	});

	await silentAgent.initialize();
	console.log("✅ Silent agent initialized (no debug logs shown)\n");

	// Example 2: Info level logging (default)
	console.log("2. Info Level Logger (default):");
	const infoAgent = new WingmanAgent({
		name: "Info Agent",
		model: new ChatOpenAI({ model: "gpt-4" }),
		logLevel: 'info',
		tools: ["read_file", "edit_file"]
	});

	await infoAgent.initialize();
	console.log("✅ Info agent initialized (info logs shown above)\n");

	// Example 3: Debug level logging (verbose)
	console.log("3. Debug Level Logger (verbose):");
	const debugAgent = new WingmanAgent({
		name: "Debug Agent",
		model: new ChatOpenAI({ model: "gpt-4" }),
		logLevel: 'debug',
		tools: ["read_file", "edit_file"]
	});

	await debugAgent.initialize();
	console.log("✅ Debug agent initialized (debug logs shown above)\n");

	// Example 4: Environment-based logging
	console.log("4. Environment-based Logger:");
	console.log("Set WINGMAN_LOG_LEVEL=debug to enable debug logging");
	console.log("Set WINGMAN_LOG_LEVEL=silent for production use");
	
	const envAgent = new WingmanAgent({
		name: "Environment Agent",
		model: new ChatOpenAI({ model: "gpt-4" }),
		// Uses WINGMAN_LOG_LEVEL environment variable or defaults to 'info'
		tools: ["read_file", "edit_file"]
	});

	await envAgent.initialize();
	console.log("✅ Environment agent initialized\n");

	// Example 5: Background agent with logging
	console.log("5. Background Agent with Logging:");
	const backgroundAgent = new WingmanAgent({
		name: "Background Agent",
		model: new ChatOpenAI({ model: "gpt-4" }),
		logLevel: 'info',
		backgroundAgentConfig: {
			pushToRemote: false,
			createPullRequest: false
		},
		tools: ["background_agent", "edit_file", "command_execute"]
	});

	// Listen for background agent events
	backgroundAgent.events.on('status', (status) => {
		console.log(`📊 Background Agent Status: ${status.agentName} - ${status.status}`);
	});

	backgroundAgent.events.on('complete', (data) => {
		console.log(`✅ Background Agent Completed: ${data.threadId} - ${data.status}`);
	});

	await backgroundAgent.initialize();
	console.log("✅ Background agent initialized with event logging\n");

	console.log("=== CLI Usage Examples ===");
	console.log("# Silent mode for CLI tools:");
	console.log("WINGMAN_LOG_LEVEL=silent your-cli-tool");
	console.log("");
	console.log("# Debug mode for troubleshooting:");
	console.log("WINGMAN_LOG_LEVEL=debug your-cli-tool");
	console.log("");
	console.log("# Default info level:");
	console.log("your-cli-tool");
}

// CLI usage example
async function cliExample() {
	// For CLI tools, you typically want silent logging to avoid interfering with output
	const agent = new WingmanAgent({
		name: "CLI Assistant",
		model: new ChatOpenAI({ model: "gpt-4" }),
		
		// Silent mode - no logs interfere with CLI output
		logger: createLogger('silent'),
		
		// Or allow users to control verbosity via environment
		// logger: createLogger(), // Uses WINGMAN_LOG_LEVEL env var
		
		tools: ["edit_file", "read_file", "command_execute"]
	});

	await agent.initialize();

	// Your CLI logic here - no debug logs will interfere with output
	console.log("CLI tool output goes to stdout");
	console.log("Logs go to stderr (when not silent)");
}

// Library usage example
async function libraryExample() {
	// For library usage, you might want more verbose logging
	const agent = new WingmanAgent({
		name: "Library Agent",
		model: new ChatOpenAI({ model: "gpt-4" }),
		
		// Debug mode for development
		logLevel: 'debug',
		
		// Or custom logger implementation
		// logger: new CustomLogger(),
		
		tools: ["edit_file", "read_file", "web_search"]
	});

	await agent.initialize();

	// Library logic here with full logging
	const result = await agent.invoke({
		input: "Read package.json and tell me the project name"
	});

	return result;
}

// Run the examples
if (require.main === module) {
	demonstrateLogging().catch(console.error);
}