import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type {
	NotificationMessage,
	RequestMessage,
	ResponseMessage,
} from "vscode-jsonrpc";
import type {
	Diagnostic,
	DocumentSymbol,
	PublishDiagnosticsParams,
} from "vscode-languageserver";

export class LspClient extends EventEmitter {
	private process: ChildProcess;
	private messageBuffer = "";
	private nextId = 1;
	private pendingRequests = new Map<
		number | string,
		{ resolve: (value: any) => void; reject: (error?: any) => void }
	>();
	private diagnosticsCache = new Map<string, Diagnostic[]>();

	constructor(
		command: string,
		args: string[],
		private readonly languageId?: string,
	) {
		super();
		this.process = spawn(command, args, { stdio: "pipe" });

		console.log(
			`LSP Client started with command: ${command} ${args.join(" ")}`,
		);

		if (!this.process.stdout || !this.process.stderr) {
			throw new Error(
				"Failed to spawn LSP process: stdout or stderr is not available.",
			);
		}

		this.process.stdout.on("data", this.handleData.bind(this));
		this.process.stderr.on("data", (data) => {
			console.error(`LSP Error: ${data.toString()}`);
		});

		this.on(
			"notification",
			(notification: NotificationMessage & { params: any }) => {
				if (notification.method === "textDocument/publishDiagnostics") {
					const params = notification.params as PublishDiagnosticsParams;
					this.diagnosticsCache.set(params.uri, params.diagnostics);
					this.emit("diagnostics", params);
				}
			},
		);
	}

	private handleData(data: Buffer) {
		this.messageBuffer += data.toString("utf-8");

		while (true) {
			const lengthMatch = this.messageBuffer.match(/Content-Length: (\d+)/);
			if (!lengthMatch) {
				break;
			}
			const contentLength = Number.parseInt(lengthMatch[1], 10);

			const headerEndIndex = this.messageBuffer.indexOf("\r\n\r\n");
			if (headerEndIndex === -1) {
				break;
			}

			const messageStartIndex = headerEndIndex + 4;
			const messageEndIndex = messageStartIndex + contentLength;

			if (this.messageBuffer.length < messageEndIndex) {
				break;
			}

			const messageStr = this.messageBuffer.substring(
				messageStartIndex,
				messageEndIndex,
			);

			this.messageBuffer = this.messageBuffer.substring(messageEndIndex);

			try {
				const message = JSON.parse(messageStr) as ResponseMessage &
					NotificationMessage;

				if (message.id && this.pendingRequests.has(message.id)) {
					// biome-ignore lint/style/noNonNullAssertion: <explanation>
					const pending = this.pendingRequests.get(message.id)!;
					if ("result" in message) {
						pending.resolve(message.result);
					} else if ("error" in message) {
						pending.reject(message.error);
					}
					this.pendingRequests.delete(message.id);
				} else {
					this.emit("notification", message);
				}
			} catch (e) {
				console.error("Error parsing LSP message", e);
			}
		}
	}

	private send(message: RequestMessage | NotificationMessage) {
		const messageStr = JSON.stringify(message);
		const rpcMessage = `Content-Length: ${Buffer.byteLength(
			messageStr,
			"utf-8",
		)}\r\n\r\n${messageStr}`;

		if (!this.process.stdin) {
			throw new Error("LSP process stdin is not available.");
		}

		this.process.stdin.write(rpcMessage);
	}

	private request<R>(method: string, params: any): Promise<R> {
		const id = this.nextId++;
		const message: RequestMessage = {
			jsonrpc: "2.0",
			id,
			method,
			params,
		};

		const promise = new Promise<R>((resolve, reject) => {
			this.pendingRequests.set(id, { resolve, reject });
		});

		this.send(message);
		return promise;
	}

	private notify(method: string, params: any): void {
		const message: NotificationMessage = {
			jsonrpc: "2.0",
			method,
			params,
		};
		this.send(message);
	}

	public async initialize(
		capabilities: any,
		initializationOptions: any,
		rootUri: string | null,
	): Promise<any> {
		const response = await this.request<any>("initialize", {
			processId: process.pid,
			rootUri,
			capabilities,
			initializationOptions,
		});

		this.notify("initialized", {});
		console.log(
			`LSP Client initialized successfully for language: ${this.languageId}`,
		);
		return response;
	}

	public didOpen(uri: string, content: string): void {
		this.notify("textDocument/didOpen", {
			textDocument: {
				uri,
				languageId: this.languageId,
				version: 1,
				text: content,
			},
		});
	}

	public getSymbols(url: string): Promise<DocumentSymbol[]> {
		return this.request<DocumentSymbol[]>("textDocument/documentSymbol", {
			textDocument: {
				uri: url,
			},
		});
	}

	public getDiagnostics(uri: string): Promise<Diagnostic[]> {
		return new Promise((resolve) => {
			if (this.diagnosticsCache.has(uri)) {
				// biome-ignore lint/style/noNonNullAssertion: <explanation>
				resolve(this.diagnosticsCache.get(uri)!);
				return;
			}

			const listener = (params: PublishDiagnosticsParams) => {
				if (params.uri === uri) {
					this.off("diagnostics", listener);
					resolve(params.diagnostics);
				}
			};

			this.on("diagnostics", listener);
		});
	}

	public async exit(): Promise<void> {
		await this.request("shutdown", undefined);
		this.notify("exit", undefined);
		this.process.kill();
	}
}
