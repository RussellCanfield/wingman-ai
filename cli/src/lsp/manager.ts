import type { NotificationMessage } from "vscode-jsonrpc";
import { LspClient } from "./client";
import { EventEmitter } from "node:events";

export class LspManager extends EventEmitter {
	private clients: Map<string, LspClient> = new Map();

	public async addClient(
		name: string,
		command: string,
		args: string[],
		capabilities: any,
		initializationOptions: any,
		rootUri: string | null = null,
		languageId?: string,
	): Promise<LspClient> {
		const client = new LspClient(command, args, languageId);
		this.clients.set(name, client);

		// Forward all notifications from the client to the manager's event emitter
		client.on("notification", (message: NotificationMessage) => {
			this.emit("notification", { client: name, message });
		});

		// The initialize method now handles the full handshake.
		await client.initialize(capabilities, initializationOptions, rootUri);

		return client;
	}

	public getClient(name: string): LspClient | undefined {
		return this.clients.get(name);
	}

	public removeClient(name: string) {
		const client = this.clients.get(name);
		if (client) {
			client.exit();
			this.clients.delete(name);
		}
	}

	public shutdown() {
		for (const client of this.clients.values()) {
			client.exit();
		}
		this.clients.clear();
	}
}
