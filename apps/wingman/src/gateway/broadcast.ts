import type { BroadcastGroup, BroadcastStrategy } from "./types.js";
import { randomBytes } from "crypto";

/**
 * Manages broadcast groups for the gateway
 */
export class BroadcastGroupManager {
	private groups: Map<string, BroadcastGroup>;

	constructor() {
		this.groups = new Map();
	}

	/**
	 * Create a new broadcast group
	 */
	createGroup(
		name: string,
		createdBy: string,
		description?: string,
		strategy: BroadcastStrategy = "parallel",
	): BroadcastGroup {
		const id = this.generateGroupId();
		const group: BroadcastGroup = {
			id,
			name,
			description,
			createdAt: Date.now(),
			createdBy,
			members: new Set(),
			strategy,
		};

		this.groups.set(id, group);
		return group;
	}

	/**
	 * Get a group by ID
	 */
	getGroup(groupId: string): BroadcastGroup | undefined {
		return this.groups.get(groupId);
	}

	/**
	 * Get a group by name
	 */
	getGroupByName(name: string): BroadcastGroup | undefined {
		for (const group of this.groups.values()) {
			if (group.name === name) {
				return group;
			}
		}
		return undefined;
	}

	/**
	 * Get or create a group by name
	 */
	getOrCreateGroup(
		name: string,
		createdBy: string,
		description?: string,
		strategy: BroadcastStrategy = "parallel",
	): BroadcastGroup {
		const existing = this.getGroupByName(name);
		if (existing) {
			return existing;
		}
		return this.createGroup(name, createdBy, description, strategy);
	}

	/**
	 * Update group strategy
	 */
	setGroupStrategy(groupId: string, strategy: BroadcastStrategy): boolean {
		const group = this.groups.get(groupId);
		if (!group) {
			return false;
		}
		group.strategy = strategy;
		return true;
	}

	/**
	 * Get group strategy
	 */
	getGroupStrategy(groupId: string): BroadcastStrategy | undefined {
		const group = this.groups.get(groupId);
		return group?.strategy;
	}

	/**
	 * Delete a group
	 */
	deleteGroup(groupId: string): boolean {
		return this.groups.delete(groupId);
	}

	/**
	 * Add a node to a group
	 */
	addNodeToGroup(groupId: string, nodeId: string): boolean {
		const group = this.groups.get(groupId);
		if (!group) {
			return false;
		}

		group.members.add(nodeId);
		return true;
	}

	/**
	 * Remove a node from a group
	 */
	removeNodeFromGroup(groupId: string, nodeId: string): boolean {
		const group = this.groups.get(groupId);
		if (!group) {
			return false;
		}

		return group.members.delete(nodeId);
	}

	/**
	 * Remove a node from all groups
	 */
	removeNodeFromAllGroups(nodeId: string): void {
		for (const group of this.groups.values()) {
			group.members.delete(nodeId);
		}
	}

	/**
	 * Get all groups a node is a member of
	 */
	getNodeGroups(nodeId: string): BroadcastGroup[] {
		const nodeGroups: BroadcastGroup[] = [];
		for (const group of this.groups.values()) {
			if (group.members.has(nodeId)) {
				nodeGroups.push(group);
			}
		}
		return nodeGroups;
	}

	/**
	 * Get all groups
	 */
	getAllGroups(): BroadcastGroup[] {
		return Array.from(this.groups.values());
	}

	/**
	 * Get group member IDs
	 */
	getGroupMembers(groupId: string): string[] {
		const group = this.groups.get(groupId);
		if (!group) {
			return [];
		}
		return Array.from(group.members);
	}

	/**
	 * Generate a unique group ID
	 */
	private generateGroupId(): string {
		return randomBytes(16).toString("hex");
	}

	/**
	 * Get statistics
	 */
	getStats() {
		return {
			totalGroups: this.groups.size,
			groups: Array.from(this.groups.values()).map((g) => ({
				id: g.id,
				name: g.name,
				memberCount: g.members.size,
				createdAt: g.createdAt,
			})),
		};
	}
}
