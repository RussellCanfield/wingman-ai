/**
 * Discovered gateway information
 */
export interface DiscoveredGateway {
	name: string;
	url: string;
	host: string;
	port: number;
	requireAuth: boolean;
	capabilities: string[];
	version: string;
	transport: "ws" | "wss";
}

/**
 * Discovery service interface
 */
export interface DiscoveryService {
	/**
	 * Start announcing this gateway
	 */
	announce(config: DiscoveryConfig): Promise<void>;

	/**
	 * Stop announcing this gateway
	 */
	stopAnnouncing(): Promise<void>;

	/**
	 * Discover available gateways
	 */
	discover(timeout?: number): Promise<DiscoveredGateway[]>;
}

/**
 * Discovery configuration
 */
export interface DiscoveryConfig {
	name: string;
	port: number;
	requireAuth: boolean;
	capabilities: string[];
	version: string;
	transport: "ws" | "wss";
}
