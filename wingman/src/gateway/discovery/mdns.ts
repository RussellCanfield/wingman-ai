import mdns from "multicast-dns";
import type {
	DiscoveryService,
	DiscoveryConfig,
	DiscoveredGateway,
} from "./types.js";
import { networkInterfaces } from "os";

const SERVICE_TYPE = "_wingman-gateway._tcp.local";

/**
 * mDNS/Bonjour discovery service for local network
 */
export class MDNSDiscoveryService implements DiscoveryService {
	private mdnsInstance: ReturnType<typeof mdns> | null = null;
	private isAnnouncing = false;
	private config: DiscoveryConfig | null = null;

	/**
	 * Start announcing this gateway on the local network
	 */
	async announce(config: DiscoveryConfig): Promise<void> {
		if (this.isAnnouncing) {
			throw new Error("Already announcing");
		}

		this.config = config;
		this.mdnsInstance = mdns();

		// Respond to queries for our service
		this.mdnsInstance.on("query", (query) => {
			// Check if query is for our service type
			const isOurService = query.questions.some(
				(q) =>
					q.name === SERVICE_TYPE || q.name === `${config.name}.${SERVICE_TYPE}`,
			);

			if (isOurService && this.mdnsInstance) {
				const hostname = this.getLocalHostname();
				const addresses = this.getLocalAddresses();

				// Build TXT record data
				const txt = [
					`version=${config.version}`,
					`auth=${config.requireAuth ? "required" : "optional"}`,
					`transport=${config.transport}`,
					`capabilities=${config.capabilities.join(",")}`,
				];

				this.mdnsInstance.respond({
					answers: [
						// PTR record - points to our service instance
						{
							name: SERVICE_TYPE,
							type: "PTR",
							ttl: 120,
							data: `${config.name}.${SERVICE_TYPE}`,
						},
						// SRV record - points to hostname and port
						{
							name: `${config.name}.${SERVICE_TYPE}`,
							type: "SRV",
							ttl: 120,
							data: {
								priority: 0,
								weight: 0,
								port: config.port,
								target: hostname,
							},
						},
						// TXT record - metadata
						{
							name: `${config.name}.${SERVICE_TYPE}`,
							type: "TXT",
							ttl: 120,
							data: Buffer.from(txt.join("\n")),
						},
						// A records - IP addresses
						...addresses.map((addr) => ({
							name: hostname,
							type: "A" as const,
							ttl: 120,
							data: addr,
						})),
					],
				});
			}
		});

		this.isAnnouncing = true;
	}

	/**
	 * Stop announcing this gateway
	 */
	async stopAnnouncing(): Promise<void> {
		if (this.mdnsInstance) {
			this.mdnsInstance.destroy();
			this.mdnsInstance = null;
		}
		this.isAnnouncing = false;
		this.config = null;
	}

	/**
	 * Discover available gateways on the local network
	 */
	async discover(timeout = 5000): Promise<DiscoveredGateway[]> {
		return new Promise((resolve) => {
			const discovered = new Map<string, DiscoveredGateway>();
			const mdnsClient = mdns();

			// Set timeout
			const timer = setTimeout(() => {
				mdnsClient.destroy();
				resolve(Array.from(discovered.values()));
			}, timeout);

			// Listen for responses
			mdnsClient.on("response", (response) => {
				try {
					const gateway = this.parseResponse(response);
					if (gateway) {
						discovered.set(gateway.name, gateway);
					}
				} catch (error) {
					// Ignore malformed responses
				}
			});

			// Query for our service type
			mdnsClient.query({
				questions: [
					{
						name: SERVICE_TYPE,
						type: "PTR",
					},
				],
			});

			// Clean up on early resolution
			const cleanup = () => {
				clearTimeout(timer);
				mdnsClient.destroy();
			};

			// Allow early cleanup
			setTimeout(cleanup, timeout);
		});
	}

	/**
	 * Parse mDNS response into DiscoveredGateway
	 */
	private parseResponse(response: any): DiscoveredGateway | null {
		const ptrRecords = response.answers.filter((a: any) => a.type === "PTR");
		const srvRecords = response.answers.filter((a: any) => a.type === "SRV");
		const txtRecords = response.answers.filter((a: any) => a.type === "TXT");
		const aRecords = response.answers.filter((a: any) => a.type === "A");

		if (ptrRecords.length === 0) {
			return null;
		}

		// Get service instance name
		const instanceName = ptrRecords[0].data.replace(`.${SERVICE_TYPE}`, "");

		// Find matching SRV and TXT records
		const srv = srvRecords.find(
			(r: any) => r.name === `${instanceName}.${SERVICE_TYPE}`,
		);
		const txt = txtRecords.find(
			(r: any) => r.name === `${instanceName}.${SERVICE_TYPE}`,
		);

		if (!srv || !txt) {
			return null;
		}

		// Parse TXT record
		const txtData = this.parseTxtRecord(txt.data);

		// Find matching A record for the hostname
		const aRecord = aRecords.find((r: any) => r.name === srv.data.target);
		const host = aRecord?.data || "localhost";

		const port = srv.data.port;
		const transport = txtData.transport || "ws";
		const url = `${transport}://${host}:${port}/ws`;

		return {
			name: instanceName,
			url,
			host,
			port,
			requireAuth: txtData.auth === "required",
			capabilities: txtData.capabilities
				? txtData.capabilities.split(",")
				: [],
			version: txtData.version || "1.0.0",
			transport: transport as "ws" | "wss",
		};
	}

	/**
	 * Parse TXT record data
	 */
	private parseTxtRecord(data: Buffer): Record<string, string> {
		const result: Record<string, string> = {};
		const text = data.toString();
		const lines = text.split("\n");

		for (const line of lines) {
			const [key, value] = line.split("=");
			if (key && value) {
				result[key.trim()] = value.trim();
			}
		}

		return result;
	}

	/**
	 * Get local hostname
	 */
	private getLocalHostname(): string {
		return `${require("os").hostname()}.local`;
	}

	/**
	 * Get local IP addresses
	 */
	private getLocalAddresses(): string[] {
		const addresses: string[] = [];
		const interfaces = networkInterfaces();

		for (const name of Object.keys(interfaces)) {
			const nets = interfaces[name];
			if (!nets) continue;

			for (const net of nets) {
				// Skip internal and IPv6 addresses
				if (net.family === "IPv4" && !net.internal) {
					addresses.push(net.address);
				}
			}
		}

		return addresses;
	}
}
