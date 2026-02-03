import type {
	DiscoveryService,
	DiscoveryConfig,
	DiscoveredGateway,
} from "./types.js";
import { exec } from "child_process";
import { promisify } from "util";
import { createLogger } from "@/logger.js";

const execAsync = promisify(exec);
const logger = createLogger();

/**
 * Tailscale-specific gateway information
 */
interface TailscaleDevice {
	id: string;
	hostname: string;
	ip: string;
	online: boolean;
	tags?: string[];
}

/**
 * Tailscale discovery service
 * Uses Tailscale CLI to discover gateways on the Tailnet
 */
export class TailscaleDiscoveryService implements DiscoveryService {
	private isAnnouncing = false;
	private config: DiscoveryConfig | null = null;

	/**
	 * Announce this gateway on Tailscale
	 * Note: Tailscale announcement is done via tags set in Tailscale admin console
	 * This method is a no-op but maintains interface compatibility
	 */
	async announce(config: DiscoveryConfig): Promise<void> {
		this.isAnnouncing = true;
		this.config = config;

		// Tailscale discovery works via tags set in admin console
		// The gateway should have tags like "tag:wingman-gateway"
		// Nothing to do here - just store config for reference
	}

	/**
	 * Stop announcing this gateway
	 */
	async stopAnnouncing(): Promise<void> {
		this.isAnnouncing = false;
		this.config = null;
	}

	/**
	 * Discover gateways on the Tailscale network
	 */
	async discover(timeout = 5000): Promise<DiscoveredGateway[]> {
		try {
			// Get Tailscale status
			const devices = await this.getTailscaleDevices();

			// Filter devices that might be gateways
			// Look for devices with "wingman-gateway" tag or specific naming pattern
			const gateways: DiscoveredGateway[] = [];

			for (const device of devices) {
				// Skip offline devices
				if (!device.online) {
					continue;
				}

				// Check if device has wingman-gateway tag
				const isGateway =
					device.tags?.some((tag) =>
						tag.toLowerCase().includes("wingman-gateway"),
					) || device.hostname.toLowerCase().includes("gateway");

				if (!isGateway) {
					continue;
				}

				// Try to get gateway info from the device
				// Assume gateway runs on default port 3000
				const gatewayInfo = await this.probeGateway(device.ip, 3000);

				if (gatewayInfo) {
					gateways.push(gatewayInfo);
				}
			}

			return gateways;
		} catch (error) {
			logger.error("Tailscale discovery failed", error);
			return [];
		}
	}

	/**
	 * Get list of Tailscale devices on the network
	 */
	private async getTailscaleDevices(): Promise<TailscaleDevice[]> {
		try {
			const { stdout } = await execAsync("tailscale status --json");
			const status = JSON.parse(stdout);

			const devices: TailscaleDevice[] = [];

			// Parse Tailscale status output
			if (status.Peer) {
				for (const [id, peerData] of Object.entries(status.Peer as any)) {
					const peer = peerData as any;
					devices.push({
						id,
						hostname: peer.HostName || peer.DNSName?.split(".")[0] || id,
						ip:
							peer.TailscaleIPs?.[0] ||
							peer.Addrs?.[0]?.split(":")[0] ||
							"",
						online: peer.Online ?? false,
						tags: peer.Tags || [],
					});
				}
			}

			return devices;
		} catch (error) {
			// If tailscale CLI is not available or fails, return empty list
			logger.error("Failed to get Tailscale devices", error);
			return [];
		}
	}

	/**
	 * Probe a device to check if it's running a Wingman gateway
	 */
	private async probeGateway(
		ip: string,
		port: number,
	): Promise<DiscoveredGateway | null> {
		try {
			// Try to fetch health endpoint
			const response = await fetch(`http://${ip}:${port}/health`, {
				signal: AbortSignal.timeout(2000),
			});

			if (!response.ok) {
				return null;
			}

			const health = (await response.json()) as any;

			// Verify it's a Wingman gateway
			if (health.service !== "wingman-gateway") {
				return null;
			}

			// Get additional stats if available
			let capabilities: string[] = ["broadcast", "direct", "groups"];
			let version = "1.0.0";

			try {
				const statsResponse = await fetch(`http://${ip}:${port}/stats`, {
					signal: AbortSignal.timeout(2000),
				});
				if (statsResponse.ok) {
					const stats = (await statsResponse.json()) as any;
					if (stats.capabilities) {
						capabilities = stats.capabilities;
					}
					if (stats.version) {
						version = stats.version;
					}
				}
			} catch {
				// Stats endpoint optional
			}

			return {
				name: health.name || `Gateway-${ip}`,
				url: `ws://${ip}:${port}/ws`,
				host: ip,
				port,
				requireAuth: health.requireAuth ?? false,
				capabilities,
				version,
				transport: "ws",
			};
		} catch (error) {
			// Not a gateway or not reachable
			return null;
		}
	}
}
