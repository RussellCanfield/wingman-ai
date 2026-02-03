import { randomBytes } from "crypto";
import type { GatewayAuthConfig, GatewayAuthPayload } from "./types.js";

/**
 * Simple token-based authentication for the gateway
 */
export class GatewayAuth {
	private tokens: Set<string>;
	private mode: GatewayAuthConfig["mode"];
	private password?: string;
	private allowTailscale: boolean;

	constructor(
		config: GatewayAuthConfig = { mode: "none" },
		initialTokens: string[] = [],
	) {
		this.mode = config.mode;
		this.password = config.password;
		this.allowTailscale = config.allowTailscale ?? false;
		this.tokens = new Set(initialTokens);

		if (config.token) {
			this.tokens.add(config.token);
		}
	}

	/**
	 * Generate a new authentication token
	 */
	generateToken(): string {
		const token = randomBytes(32).toString("hex");
		this.tokens.add(token);
		return token;
	}

	/**
	 * Validate an authentication token
	 */
	validate(auth?: GatewayAuthPayload, tailscaleUser?: string): boolean {
		if (this.mode === "none") {
			return true;
		}

		if (this.allowTailscale && tailscaleUser) {
			return true;
		}

		if (this.mode === "token") {
			if (!auth?.token) {
				return false;
			}
			return this.tokens.has(auth.token);
		}

		if (this.mode === "password") {
			if (!auth?.password || !this.password) {
				return false;
			}
			return auth.password === this.password;
		}

		return false;
	}

	/**
	 * Add a token to the valid tokens set
	 */
	addToken(token: string): void {
		this.tokens.add(token);
	}

	/**
	 * Remove a token from the valid tokens set
	 */
	revokeToken(token: string): boolean {
		return this.tokens.delete(token);
	}

	/**
	 * Get all valid tokens
	 */
	getTokens(): string[] {
		return Array.from(this.tokens);
	}

	/**
	 * Check if authentication is required
	 */
	isAuthRequired(): boolean {
		return this.mode !== "none";
	}

	setAuthRequired(required: boolean): void {
		this.mode = required ? "token" : "none";
	}
}
