import { GatewayServer, GatewayDaemon, GatewayClient } from "../../gateway/index.js";
import type { GatewayConfig } from "../../gateway/types.js";
import { readFileSync } from "fs";
import { createLogger, getLogFilePath } from "@/logger.js";

const logger = createLogger();
const logFile = getLogFilePath();

function reportGatewayError(context: string, error: unknown): void {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logger.error(context, errorMsg);
	console.error(`✗ ${context}: ${errorMsg}`);
	console.error(`Logs: ${logFile}`);
}

/**
 * Gateway command arguments
 */
export interface GatewayCommandArgs {
	subcommand: string;
	args: string[];
	options: Record<string, unknown>;
}

/**
 * Execute gateway command
 */
export async function executeGatewayCommand(
	args: GatewayCommandArgs,
): Promise<void> {
	const { subcommand, options } = args;

	switch (subcommand) {
		case "start":
			await handleStart(options);
			break;
		case "stop":
			await handleStop();
			break;
		case "restart":
			await handleRestart();
			break;
		case "status":
			await handleStatus();
			break;
		case "run":
			await handleRun(options);
			break;
		case "join":
			await handleJoin(args.args, options);
			break;
		case "discover":
			await handleDiscover(options);
			break;
		case "token":
			await handleToken(options);
			break;
		case "health":
			await handleHealth(options);
			break;
		case "tunnel":
			await handleTunnel(args.args, options);
			break;
		default:
			showGatewayHelp();
			process.exit(1);
	}
}

/**
 * Start the gateway as a daemon
 */
async function handleStart(options: Record<string, unknown>): Promise<void> {
	const config: GatewayConfig = {
		port: (options.port as number) || 3000,
		host: (options.host as string) || "0.0.0.0",
		requireAuth: (options.auth as boolean) || false,
		authToken: options.token as string | undefined,
		maxNodes: (options.maxNodes as number) || 1000,
		pingInterval: (options.pingInterval as number) || 30000,
		pingTimeout: (options.pingTimeout as number) || 60000,
		logLevel: (options.logLevel as any) || "info",
	};

	// Add discovery configuration if provided
	if (options.discovery) {
		config.discovery = {
			enabled: true,
			method: (options.discovery as string) as "mdns" | "tailscale",
			name: (options.name as string) || `Gateway-${Date.now()}`,
		};
	}

	const daemon = new GatewayDaemon();

	try {
		await daemon.start(config);
		console.log("✓ Gateway started successfully");
		console.log(`  URL: ws://${config.host}:${config.port}/ws`);
		console.log(`  Health: http://${config.host}:${config.port}/health`);
		console.log(`  Logs: ${daemon.getLogFile()}`);

		if (config.requireAuth && !config.authToken) {
			console.log(
				"\n⚠ Authentication is enabled but no token was provided.",
			);
			console.log(
				'  Run "wingman gateway token --generate" to create a token.',
			);
		}
	} catch (error) {
		reportGatewayError("Failed to start gateway", error);
		process.exit(1);
	}
}

/**
 * Stop the gateway daemon
 */
async function handleStop(): Promise<void> {
	const daemon = new GatewayDaemon();

	try {
		await daemon.stop();
		console.log("✓ Gateway stopped successfully");
	} catch (error) {
		reportGatewayError("Failed to stop gateway", error);
		process.exit(1);
	}
}

/**
 * Restart the gateway daemon
 */
async function handleRestart(): Promise<void> {
	const daemon = new GatewayDaemon();

	try {
		await daemon.restart();
		console.log("✓ Gateway restarted successfully");
	} catch (error) {
		reportGatewayError("Failed to restart gateway", error);
		process.exit(1);
	}
}

/**
 * Get gateway status
 */
async function handleStatus(): Promise<void> {
	const daemon = new GatewayDaemon();
	const status = daemon.getStatus();

	if (!status.running) {
		console.log("Gateway Status: Not Running");
		return;
	}

	console.log("Gateway Status: Running");
	console.log(`  PID: ${status.pid}`);
	if (status.uptime) {
		const uptimeSeconds = Math.floor(status.uptime / 1000);
		const hours = Math.floor(uptimeSeconds / 3600);
		const minutes = Math.floor((uptimeSeconds % 3600) / 60);
		const seconds = uptimeSeconds % 60;
		console.log(`  Uptime: ${hours}h ${minutes}m ${seconds}s`);
	}
	if (status.config) {
		console.log(`  Host: ${status.config.host}`);
		console.log(`  Port: ${status.config.port}`);
		console.log(`  Auth Required: ${status.config.requireAuth}`);
		console.log(`  Max Nodes: ${status.config.maxNodes}`);
	}
	console.log(`  Log File: ${daemon.getLogFile()}`);
}

/**
 * Run the gateway server (not as daemon)
 */
async function handleRun(options: Record<string, unknown>): Promise<void> {
	let config: GatewayConfig;

	// Check if running as daemon with config file
	if (options.daemon && process.env.WINGMAN_GATEWAY_CONFIG) {
		const configStr = readFileSync(
			process.env.WINGMAN_GATEWAY_CONFIG,
			"utf-8",
		);
		config = JSON.parse(configStr);
	} else {
		config = {
			port: (options.port as number) || 3000,
			host: (options.host as string) || "0.0.0.0",
			requireAuth: (options.auth as boolean) || false,
			authToken: options.token as string | undefined,
			maxNodes: (options.maxNodes as number) || 1000,
			pingInterval: (options.pingInterval as number) || 30000,
			pingTimeout: (options.pingTimeout as number) || 60000,
			logLevel: (options.logLevel as any) || "info",
		};
	}

	const server = new GatewayServer(config);

	// Handle shutdown signals
	process.on("SIGTERM", async () => {
		console.log("Received SIGTERM, shutting down gracefully...");
		await server.stop();
		process.exit(0);
	});

	process.on("SIGINT", async () => {
		console.log("Received SIGINT, shutting down gracefully...");
		await server.stop();
		process.exit(0);
	});

	try {
		await server.start();
		console.log("✓ Gateway running");
		console.log(`  URL: ws://${config.host}:${config.port}/ws`);
		console.log(`  Health: http://${config.host}:${config.port}/health`);

		if (config.requireAuth && config.authToken) {
			console.log(`  Auth Token: ${config.authToken}`);
		}

		// Keep the process running
		await new Promise(() => {});
	} catch (error) {
		reportGatewayError("Failed to start gateway", error);
		process.exit(1);
	}
}

/**
 * Join the gateway as a node
 */
async function handleJoin(
	args: string[],
	options: Record<string, unknown>,
): Promise<void> {
	const url = args[0] || `ws://localhost:3000/ws`;
	const name = (options.name as string) || `node-${Date.now()}`;
	const token = options.token as string | undefined;
	const group = options.group as string | undefined;
	const transport = (options.transport as "websocket" | "http" | "auto") || "auto";

	console.log(`Connecting to gateway: ${url}`);
	console.log(`Node name: ${name}`);
	if (transport !== "auto") {
		console.log(`Transport: ${transport}`);
	}

	const client = new GatewayClient(url, name, {
		token,
		transport,
		events: {
			connected: () => {
				console.log("✓ Connected to gateway");
			},
			registered: (nodeId, nodeName) => {
				console.log(`✓ Registered as ${nodeName} (${nodeId})`);

				// Join group if specified
				if (group) {
					client.joinGroup(group);
				}
			},
			joinedGroup: (groupId, groupName) => {
				console.log(`✓ Joined group: ${groupName} (${groupId})`);
				console.log("\nReady to receive messages. Press Ctrl+C to exit.");
			},
			broadcast: (message, fromNodeId, groupId) => {
				console.log(`\n[Broadcast from ${fromNodeId}]:`);
				console.log(JSON.stringify(message, null, 2));
			},
			direct: (message, fromNodeId) => {
				console.log(`\n[Direct from ${fromNodeId}]:`);
				console.log(JSON.stringify(message, null, 2));
			},
			error: (error) => {
				logger.error("Gateway error event", error.message);
				console.error(`\n✗ Error: ${error.message}`);
				console.error(`Logs: ${logFile}`);
			},
			disconnected: () => {
				console.log("\n✗ Disconnected from gateway");
			},
		},
	});

	try {
		await client.connect();

		// Handle shutdown
		process.on("SIGINT", () => {
			console.log("\nDisconnecting...");
			client.disconnect();
			process.exit(0);
		});

		// Keep the process running
		await new Promise(() => {});
	} catch (error) {
		reportGatewayError("Failed to connect", error);
		process.exit(1);
	}
}

/**
 * Discover available gateways on the local network
 */
async function handleDiscover(options: Record<string, unknown>): Promise<void> {
	const timeout = (options.timeout as number) || 5000;
	const verbose = options.verbose as boolean;
	const tailscale = options.tailscale as boolean;

	if (tailscale) {
		console.log("Discovering gateways on Tailscale network...");

		const { TailscaleDiscoveryService } = await import(
			"../../gateway/discovery/tailscale.js"
		);
		const ts = new TailscaleDiscoveryService();

		try {
			const gateways = await ts.discover(timeout);

			if (gateways.length === 0) {
				console.log("\nNo gateways found on Tailscale network");
				console.log("\nTo start a Tailscale-discoverable gateway:");
				console.log(
					'  wingman gateway start --discovery tailscale --name "My Gateway"',
				);
				console.log(
					'\nNote: Ensure your gateway has the "wingman-gateway" tag in Tailscale',
				);
				return;
			}

			console.log(`\n✓ Found ${gateways.length} gateway(s):\n`);

			for (const gw of gateways) {
				console.log(`  ${gw.name}`);
				console.log(`    URL: ${gw.url}`);
				console.log(`    Auth: ${gw.requireAuth ? "Required" : "Optional"}`);

				if (verbose) {
					console.log(`    Host: ${gw.host}`);
					console.log(`    Port: ${gw.port}`);
					console.log(`    Transport: ${gw.transport}`);
					console.log(`    Capabilities: ${gw.capabilities.join(", ")}`);
					console.log(`    Version: ${gw.version}`);
				}
				console.log();
			}

			console.log("To connect to a gateway:");
			console.log(`  wingman gateway join <url> --name "my-node"`);
		} catch (error) {
			reportGatewayError("Discovery failed", error);
			process.exit(1);
		}
		return;
	}

	console.log(`Discovering gateways on local network (${timeout}ms timeout)...`);

	const { MDNSDiscoveryService } = await import("../../gateway/discovery/mdns.js");
	const mdns = new MDNSDiscoveryService();

	try {
		const gateways = await mdns.discover(timeout);

		if (gateways.length === 0) {
			console.log("\nNo gateways found on local network");
			console.log("\nTo start a discoverable gateway:");
			console.log('  wingman gateway start --discovery mdns --name "My Gateway"');
			return;
		}

		console.log(`\n✓ Found ${gateways.length} gateway(s):\n`);

		for (const gw of gateways) {
			console.log(`  ${gw.name}`);
			console.log(`    URL: ${gw.url}`);
			console.log(`    Auth: ${gw.requireAuth ? "Required" : "Optional"}`);

			if (verbose) {
				console.log(`    Host: ${gw.host}`);
				console.log(`    Port: ${gw.port}`);
				console.log(`    Transport: ${gw.transport}`);
				console.log(`    Capabilities: ${gw.capabilities.join(", ")}`);
				console.log(`    Version: ${gw.version}`);
			}
			console.log();
		}

		console.log("To connect to a gateway:");
		console.log(`  wingman gateway join <url> --name "my-node"`);
	} catch (error) {
		reportGatewayError("Discovery failed", error);
		process.exit(1);
	}
}

/**
 * Generate or manage auth tokens
 */
async function handleToken(options: Record<string, unknown>): Promise<void> {
	if (options.generate) {
		const { GatewayAuth } = await import("../../gateway/auth.js");
		const auth = new GatewayAuth();
		const token = auth.generateToken();
		console.log("Generated token:");
		console.log(token);
		console.log(
			'\nUse this token with: wingman gateway start --auth --token="<token>"',
		);
	} else {
		console.log("Usage: wingman gateway token --generate");
	}
}

/**
 * Check gateway health
 */
async function handleHealth(options: Record<string, unknown>): Promise<void> {
	const host = (options.host as string) || "localhost";
	const port = (options.port as number) || 3000;
	const url = `http://${host}:${port}/health`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const health = await response.json();
		console.log("Gateway Health:");
		console.log(JSON.stringify(health, null, 2));
	} catch (error) {
		reportGatewayError("Failed to check health", error);
		process.exit(1);
	}
}

/**
 * Create SSH tunnel to gateway and auto-connect
 */
async function handleTunnel(
	args: string[],
	options: Record<string, unknown>,
): Promise<void> {
	const sshHost = args[0];
	if (!sshHost) {
		logger.error("SSH host required");
		console.error("✗ SSH host required");
		console.error(`Logs: ${logFile}`);
		console.log("\nUsage:");
		console.log("  wingman gateway tunnel user@host [options]");
		console.log("\nOptions:");
		console.log("  --port <number>       Gateway port on remote host (default: 3000)");
		console.log("  --local-port <number> Local port for tunnel (default: random)");
		console.log("  --name <string>       Node name after connecting");
		console.log("  --group <string>      Auto-join broadcast group");
		process.exit(1);
	}

	const remotePort = (options.port as number) || 3000;
	const localPort = (options.localPort as number) || 0; // 0 = random port
	const name = (options.name as string) || `tunnel-node-${Date.now()}`;
	const group = options.group as string | undefined;

	// Find available local port if not specified
	const actualLocalPort = localPort || (await findAvailablePort());

	console.log("Creating SSH tunnel to gateway...");
	console.log(`  SSH Host: ${sshHost}`);
	console.log(`  Remote Port: ${remotePort}`);
	console.log(`  Local Port: ${actualLocalPort}`);
	console.log();

	// Create SSH tunnel using child_process
	const { spawn } = await import("child_process");

	const sshArgs = [
		"-L",
		`${actualLocalPort}:localhost:${remotePort}`,
		"-N", // Don't execute remote command
		"-o",
		"ExitOnForwardFailure=yes",
		sshHost,
	];

	const sshProcess = spawn("ssh", sshArgs, {
		stdio: "inherit",
	});

	// Wait a bit for tunnel to establish
	await new Promise((resolve) => setTimeout(resolve, 2000));

	if (sshProcess.exitCode !== null) {
		logger.error("Failed to create SSH tunnel");
		console.error("✗ Failed to create SSH tunnel");
		console.error(`Logs: ${logFile}`);
		process.exit(1);
	}

	console.log("✓ SSH tunnel established");
	console.log();
	console.log("Connecting to gateway through tunnel...");

	// Create gateway client
	const { GatewayClient } = await import("../../gateway/client.js");

	const client = new GatewayClient(
		`ws://localhost:${actualLocalPort}/ws`,
		name,
		{
			events: {
				connected: () => {
					console.log("✓ Connected to gateway");
				},
				registered: (nodeId, nodeName) => {
					console.log(`✓ Registered as ${nodeName} (${nodeId})`);

					// Join group if specified
					if (group) {
						client.joinGroup(group);
					}
				},
				joinedGroup: (groupId, groupName) => {
					console.log(`✓ Joined group: ${groupName} (${groupId})`);
					console.log("\nReady to receive messages. Press Ctrl+C to exit.");
				},
				broadcast: (message, fromNodeId, groupId) => {
					console.log(`\n[Broadcast from ${fromNodeId}]:`);
					console.log(JSON.stringify(message, null, 2));
				},
				direct: (message, fromNodeId) => {
					console.log(`\n[Direct from ${fromNodeId}]:`);
					console.log(JSON.stringify(message, null, 2));
				},
				error: (error) => {
					logger.error("Gateway error event", error.message);
					console.error(`\n✗ Error: ${error.message}`);
					console.error(`Logs: ${logFile}`);
				},
				disconnected: () => {
					console.log("\n✗ Disconnected from gateway");
				},
			},
		},
	);

	try {
		await client.connect();

		// Handle shutdown
		process.on("SIGINT", () => {
			console.log("\nClosing tunnel and disconnecting...");
			client.disconnect();
			sshProcess.kill();
			process.exit(0);
		});

		// If SSH process exits, disconnect client
		sshProcess.on("exit", (code) => {
			console.log(`\n✗ SSH tunnel closed (exit code: ${code})`);
			client.disconnect();
			process.exit(code || 0);
		});

		// Keep the process running
		await new Promise(() => {});
	} catch (error) {
		reportGatewayError("Failed to connect", error);
		sshProcess.kill();
		process.exit(1);
	}
}

/**
 * Find an available port
 */
async function findAvailablePort(): Promise<number> {
	const net = await import("net");

	return new Promise((resolve, reject) => {
		const server = net.createServer();

		server.listen(0, () => {
			const address = server.address() as { port: number };
			const port = address.port;
			server.close(() => {
				resolve(port);
			});
		});

		server.on("error", reject);
	});
}

/**
 * Show gateway help
 */
function showGatewayHelp(): void {
	console.log(`
Wingman Gateway - AI Agent Swarming Gateway

Usage:
  wingman gateway <subcommand> [options]

Subcommands:
  start                Start the gateway as a daemon
  stop                 Stop the gateway daemon
  restart              Restart the gateway daemon
  status               Show gateway status
  run                  Run the gateway in foreground
  join <url>           Join a gateway as a node
  discover             Discover gateways on local network
  tunnel <ssh-host>    Create SSH tunnel and connect to gateway
  token                Generate authentication token
  health               Check gateway health

Start Options:
  --port <number>      Port to listen on (default: 3000)
  --host <string>      Host to bind to (default: 0.0.0.0)
  --auth               Enable authentication
  --token <string>     Authentication token
  --max-nodes <number> Maximum number of nodes (default: 1000)
  --log-level <level>  Log level (debug|info|warn|error|silent)
  --discovery <method> Discovery method: mdns, tailscale
  --name <string>      Gateway name for discovery

Join Options:
  --name <string>      Node name
  --token <string>     Authentication token
  --group <string>     Auto-join broadcast group
  --transport <type>   Transport type: websocket, http, auto (default: auto)

Discover Options:
  --timeout <ms>       Discovery timeout (default: 5000)
  --verbose            Show detailed gateway info
  --tailscale          Discover on Tailscale network instead of LAN

Tunnel Options:
  --port <number>      Gateway port on remote host (default: 3000)
  --local-port <number> Local port for tunnel (default: random)
  --name <string>      Node name after connecting
  --group <string>     Auto-join broadcast group

Token Options:
  --generate           Generate a new token

Health Options:
  --host <string>      Gateway host (default: localhost)
  --port <number>      Gateway port (default: 3000)

Examples:
  # Start gateway locally
  wingman gateway start

  # Start with mDNS discovery (LAN)
  wingman gateway start --discovery mdns --name "Home Gateway"

  # Start with Tailscale discovery
  wingman gateway start --discovery tailscale --name "Work Gateway"

  # Start with authentication
  wingman gateway token --generate
  wingman gateway start --auth --token="<token>"

  # Start on custom port
  wingman gateway start --port 8080

  # Discover gateways on local network
  wingman gateway discover
  wingman gateway discover --verbose

  # Discover gateways on Tailscale
  wingman gateway discover --tailscale
  wingman gateway discover --tailscale --verbose

  # Join a gateway
  wingman gateway join ws://localhost:3000/ws --name="agent-1" --group="swarm"

  # Join via HTTP bridge (firewall traversal)
  wingman gateway join http://localhost:3000 --transport http --name="agent-1"

  # Auto-select transport
  wingman gateway join http://localhost:3000 --transport auto --name="agent-1"

  # Connect via SSH tunnel
  wingman gateway tunnel user@remote-host --name="tunnel-node"
  wingman gateway tunnel user@remote-host --port 3000 --group="swarm"

  # Check status
  wingman gateway status

  # Check health
  wingman gateway health

Deployment:
  Local:      Run on localhost or LAN
  Tailscale:  Accessible over Tailscale network
  Cloudflare: Deploy to Cloudflare Workers (see cloudflare/README.md)
  `);
}
