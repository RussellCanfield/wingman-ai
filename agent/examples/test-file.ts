/**
 * Interview Question: User Data Cache System
 *
 * This code implements a caching system for user data with TTL (Time To Live).
 * Your task is to identify and fix the bug(s) in this implementation.
 *
 * Expected behavior:
 * - Cache should store user data with expiration times
 * - Expired entries should be automatically removed
 * - Cache should have a maximum size limit
 * - Performance should be optimized for frequent reads
 */

interface User {
	id: string;
	name: string;
	email: string;
	lastActive: Date;
}

interface CacheEntry<T> {
	data: T;
	expiresAt: number;
	accessCount: number;
}

class UserDataCache {
	private cache: Map<string, CacheEntry<User>> = new Map();
	private maxSize: number;
	private defaultTTL: number; // in milliseconds

	constructor(maxSize = 100, defaultTTL: number = 5 * 60 * 1000) {
		this.maxSize = maxSize;
		this.defaultTTL = defaultTTL;
	}

	/**
	 * Stores user data in cache with TTL
	 */
	set(userId: string, userData: User, ttl?: number): void {
		const expirationTime = Date.now() + (ttl || this.defaultTTL);

		// Remove expired entries before adding new one
		this.cleanupExpired();

		// If cache is full, remove least recently used item
		if (this.cache.size >= this.maxSize) {
			this.evictLRU();
		}

		const entry: CacheEntry<User> = {
			data: userData,
			expiresAt: expirationTime,
			accessCount: 1,
		};

		this.cache.set(userId, entry);
	}

	/**
	 * Retrieves user data from cache
	 */
	get(userId: string): User | null {
		const entry = this.cache.get(userId);

		if (!entry) {
			return null;
		}

		// Check if entry has expired
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(userId);
			return null;
		}

		// Update access count for LRU tracking
		entry.accessCount++;

		return entry.data;
	}

	/**
	 * Removes expired entries from cache
	 */
	private cleanupExpired(): void {
		const now = Date.now();

		for (const [userId, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(userId);
			}
		}
	}

	/**
	 * Evicts least recently used item when cache is full
	 */
	private evictLRU(): void {
		let lruKey: string | null = null;
		let minAccessCount = Number.POSITIVE_INFINITY;

		for (const [userId, entry] of this.cache.entries()) {
			if (entry.accessCount < minAccessCount) {
				minAccessCount = entry.accessCount;
				lruKey = userId;
			}
		}

		if (lruKey) {
			this.cache.delete(lruKey);
		}
	}

	/**
	 * Gets current cache statistics
	 */
	getStats(): { size: number; maxSize: number; hitRate: number } {
		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			hitRate: 0, // TODO: Implement hit rate calculation
		};
	}

	/**
	 * Clears all cache entries
	 */
	clear(): void {
		this.cache.clear();
	}
}
