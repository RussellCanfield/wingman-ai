import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import * as tar from "tar";
import type { ILoggingProvider } from "@shared/types/Logger";
import {
	EVENT_BINDINGS_FAILED,
	telemetry,
} from "../providers/telemetryProvider";
import { getPlatformIdentifier } from "./utils";

export interface BindingConfig {
	name: string;
	version: string;
	packagePrefix: string;
	// Add a property to control the output filename format
	usePackagePrefixInFilename?: boolean;
}

export class BindingDownloader {
	private readonly storageDir: string;
	private readonly extensionDir: string;
	private readonly maxRetries = 3;
	private readonly retryDelay = 1000;
	private readonly bindings: BindingConfig[] = [
		{
			name: "ast-grep-napi",
			version: "0.36.1",
			packagePrefix: "@ast-grep/napi",
			usePackagePrefixInFilename: false,
		},
		{
			name: "lancedb",
			version: "0.18.2",
			packagePrefix: "@lancedb/lancedb",
		},
	];

	constructor(
		context: vscode.ExtensionContext,
		private logger: ILoggingProvider,
	) {
		this.extensionDir = context.extensionPath;
		this.storageDir = path.join(
			context.globalStorageUri.fsPath,
			"native-bindings",
		);

		if (!fs.existsSync(this.storageDir)) {
			fs.mkdirSync(this.storageDir, { recursive: true });
		}
	}

	private getBindingStorageDir(binding: BindingConfig): string {
		const dir = path.join(this.storageDir, binding.name, binding.version);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		return dir;
	}

	private async getNapiPackageName(binding: BindingConfig): Promise<string> {
		const platformId = await getPlatformIdentifier();
		const packageName = `${binding.packagePrefix}-${platformId}`;

		this.logger.logInfo(
			`Using native binding package for ${binding.name}: ${packageName}`,
		);

		return packageName;
	}

	private async getStoredBindingPath(binding: BindingConfig): Promise<string> {
		const pkg = await this.getNapiPackageName(binding);
		return path.join(
			this.getBindingStorageDir(binding),
			`${pkg.split("/").pop()}.node`,
		);
	}

	private getTempExtractPath(binding: BindingConfig): string {
		return path.join(this.getBindingStorageDir(binding), "extract");
	}

	private async getTargetBindingPath(binding: BindingConfig): Promise<string> {
		const platformId = await getPlatformIdentifier();
		let filename: string;

		if (binding.usePackagePrefixInFilename) {
			// Use the package prefix in the filename (e.g., ast-grep-napi.darwin-arm64.node)
			const prefix = binding.packagePrefix.split("/").pop();
			filename = `${prefix}.${platformId}.node`;
		} else {
			// Use the original naming convention (e.g., ast-grep.darwin-arm64.node)
			filename = `${binding.name}.${platformId}.node`;
		}

		this.logger.logInfo(
			`Generated target filename for ${binding.name}: ${filename}`,
		);

		return path.join(this.extensionDir, "out", filename);
	}

	private async retryOperation<T>(
		operation: () => Promise<T>,
		errorMessage: string,
	): Promise<T> {
		let lastError: Error | undefined;

		for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error as Error;
				if (attempt === this.maxRetries) {
					break;
				}

				this.logger.logInfo(
					`${errorMessage} - Attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`,
				);
				await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
			}
		}

		throw lastError;
	}

	private async downloadBinding(binding: BindingConfig): Promise<void> {
		const pkg = await this.getNapiPackageName(binding);
		const url = `https://registry.npmjs.org/${pkg}/-/${pkg
			.split("/")
			.pop()}-${binding.version}.tgz`;

		this.logger.logInfo(
			`Downloading ${binding.name} binding for ${process.platform}-${process.arch}`,
		);
		this.logger.logInfo(`URL: ${url}`);

		try {
			const response = await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `Downloading ${binding.name} bindings...`,
					cancellable: false,
				},
				async () => {
					const { default: fetch } = await import("node-fetch");
					return await this.retryOperation(async () => {
						const response = await fetch(url);
						if (!response.ok) {
							throw new Error(
								`Failed to download binding: ${response.statusText}`,
							);
						}
						return response;
					}, "Download failed");
				},
			);

			const buffer = await response.arrayBuffer();
			const extractDir = this.getTempExtractPath(binding);

			// Ensure extract directory exists and is empty
			if (fs.existsSync(extractDir)) {
				fs.rmSync(extractDir, { recursive: true, force: true });
			}
			fs.mkdirSync(extractDir, { recursive: true });

			// Extract tarball
			const tarballPath = path.join(extractDir, `${pkg.split("/").pop()}.tgz`);
			fs.writeFileSync(tarballPath, Buffer.from(buffer));

			await this.retryOperation(async () => {
				await tar.x({
					file: tarballPath,
					cwd: extractDir,
				});
			}, "Extraction failed");

			// Move binding to storage
			const packageDir = path.join(extractDir, "package");
			const files = fs.readdirSync(packageDir);
			for (const file of files) {
				if (file.endsWith(".node")) {
					const srcPath = path.join(packageDir, file);
					const destPath = await this.getStoredBindingPath(binding);
					await this.retryOperation(async () => {
						fs.copyFileSync(srcPath, destPath);
					}, "File copy failed");
					this.logger.logInfo(`Cached ${binding.name} binding to ${destPath}`);
				}
			}

			// Keep the extracted files for future use
			this.logger.logInfo(
				`Preserving extracted ${binding.name} files for future use`,
			);
		} catch (error) {
			this.logger.logError(error, true);
			vscode.window.showErrorMessage(
				`Failed to download ${binding.name} bindings`,
			);
			throw error;
		}
	}

	async ensureBindings(): Promise<void> {
		const results = await Promise.allSettled(
			this.bindings.map((binding) => this.ensureBinding(binding)),
		);

		// Check for failures
		const failures = results
			.map((result, index) => ({ result, binding: this.bindings[index] }))
			.filter((item) => item.result.status === "rejected");

		if (failures.length > 0) {
			const bindingNames = failures.map((item) => item.binding.name).join(", ");
			throw new Error(`Failed to ensure bindings for: ${bindingNames}`);
		}
	}

	async ensureBinding(binding: BindingConfig): Promise<void> {
		const pkg = await this.getNapiPackageName(binding);
		const storedPath = await this.getStoredBindingPath(binding);
		const targetPath = await this.getTargetBindingPath(binding);

		try {
			// Check if binding exists in storage
			if (!fs.existsSync(storedPath)) {
				this.logger.logInfo(
					`${binding.name} binding not found in cache, downloading...`,
				);
				await this.downloadBinding(binding);
			}

			// Ensure target directory exists
			fs.mkdirSync(path.dirname(targetPath), { recursive: true });

			// Copy from storage to out directory if needed
			if (
				!fs.existsSync(targetPath) ||
				fs.statSync(storedPath).size !== fs.statSync(targetPath).size
			) {
				await this.retryOperation(async () => {
					fs.copyFileSync(storedPath, targetPath);
				}, "Installation copy failed");
				this.logger.logInfo(
					`Installed ${binding.name} binding to ${targetPath}`,
				);
			} else {
				this.logger.logInfo(`${binding.name} binding already installed.`);
			}
		} catch (error) {
			telemetry.sendError(EVENT_BINDINGS_FAILED, {
				pkg,
				binding: binding.name,
			});
			this.logger.logError(error, true);
			throw error;
		}
	}
}
