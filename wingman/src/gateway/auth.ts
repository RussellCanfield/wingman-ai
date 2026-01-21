import { randomBytes } from "crypto";

/**
 * Simple token-based authentication for the gateway
 */
export class GatewayAuth {
	private tokens: Set<string>;
	private requireAuth: boolean;

	constructor(requireAuth = false, initialTokens: string[] = []) {
		this.requireAuth = requireAuth;
		this.tokens = new Set(initialTokens);
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
	validateToken(token?: string): boolean {
		// If auth is not required, always return true
		if (!this.requireAuth) {
			return true;
		}

		// If auth is required but no token provided, return false
		if (!token) {
			return false;
		}

		return this.tokens.has(token);
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
		return this.requireAuth;
	}

	/**
	 * Set whether authentication is required
	 */
	setAuthRequired(required: boolean): void {
		this.requireAuth = required;
	}
}
