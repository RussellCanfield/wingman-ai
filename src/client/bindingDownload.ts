import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as tar from 'tar';
import { ILoggingProvider } from "@shared/types/Logger";
import { EVENT_BINDINGS_FAILED, telemetry } from '../providers/telemetryProvider';
import { getPlatformIdentifier } from './utils';

export class BindingDownloader {
    private readonly storageDir: string;
    private readonly extensionDir: string;
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000;
    private readonly bindingVersion = '0.29.0';

    constructor(
        context: vscode.ExtensionContext,
        private logger: ILoggingProvider
    ) {
        this.extensionDir = context.extensionPath;
        this.storageDir = path.join(context.globalStorageUri.fsPath, 'ast-grep-bindings', this.bindingVersion);

        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }

    private async getNapiPackageName(): Promise<string> {
        const platformId = await getPlatformIdentifier();
        const packageName = `@ast-grep/napi-${platformId}`;

        this.logger.logInfo(`Using native binding package: ${packageName}`);

        return packageName;
    }

    private async getStoredBindingPath(): Promise<string> {
        const pkg = await this.getNapiPackageName();
        return path.join(this.storageDir, `${pkg.split('/').pop()}.node`);
    }

    private getTempExtractPath(): string {
        return path.join(this.storageDir, 'extract');
    }

    private async getTargetBindingPath(): Promise<string> {
        const platformId = await getPlatformIdentifier();
        const filename = `ast-grep-napi.${platformId}.node`;

        this.logger.logInfo(`Generated target filename: ${filename}`);

        return path.join(
            this.extensionDir,
            'out',
            filename
        );
    }

    private async retryOperation<T>(
        operation: () => Promise<T>,
        errorMessage: string
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
                    `${errorMessage} - Attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`
                );
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
        }

        throw lastError;
    }

    private async downloadBinding(): Promise<void> {
        const pkg = await this.getNapiPackageName();
        const url = `https://registry.npmjs.org/${pkg}/-/${pkg
            .split('/')
            .pop()}-${this.bindingVersion}.tgz`;

        this.logger.logInfo(`Downloading binding for ${process.platform}-${process.arch}`);
        this.logger.logInfo(`URL: ${url}`);

        try {
            const response = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Downloading AST-grep bindings...",
                cancellable: false
            }, async () => {
                const { default: fetch } = await import('node-fetch');
                return await this.retryOperation(
                    async () => {
                        const response = await fetch(url);
                        if (!response.ok) {
                            throw new Error(`Failed to download binding: ${response.statusText}`);
                        }
                        return response;
                    },
                    'Download failed'
                );
            });

            const buffer = await response.arrayBuffer();
            const extractDir = this.getTempExtractPath();

            // Ensure extract directory exists and is empty
            if (fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, { recursive: true, force: true });
            }
            fs.mkdirSync(extractDir, { recursive: true });

            // Extract tarball
            const tarballPath = path.join(extractDir, `${pkg.split('/').pop()}.tgz`);
            fs.writeFileSync(tarballPath, Buffer.from(buffer));

            await this.retryOperation(
                async () => {
                    await tar.x({
                        file: tarballPath,
                        cwd: extractDir,
                    });
                },
                'Extraction failed'
            );

            // Move binding to storage
            const packageDir = path.join(extractDir, 'package');
            const files = fs.readdirSync(packageDir);
            for (const file of files) {
                if (file.endsWith('.node')) {
                    const srcPath = path.join(packageDir, file);
                    const destPath = await this.getStoredBindingPath();
                    await this.retryOperation(
                        async () => {
                            fs.copyFileSync(srcPath, destPath);
                        },
                        'File copy failed'
                    );
                    this.logger.logInfo(`Cached binding to ${destPath}`);
                }
            }

            // Keep the extracted files for future use
            this.logger.logInfo('Preserving extracted files for future use');
        } catch (error) {
            this.logger.logError(error, true);
            vscode.window.showErrorMessage('Failed to download AST-grep bindings');
            throw error;
        }
    }

    async ensureBindings(): Promise<void> {
        const pkg = await this.getNapiPackageName();
        const storedPath = await this.getStoredBindingPath();
        const targetPath = await this.getTargetBindingPath();

        try {
            // Check if binding exists in storage
            if (!fs.existsSync(storedPath)) {
                this.logger.logInfo('Binding not found in cache, downloading...');
                await this.downloadBinding();
            }

            // Ensure target directory exists
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });

            // Copy from storage to out directory if needed
            if (!fs.existsSync(targetPath) ||
                fs.statSync(storedPath).size !== fs.statSync(targetPath).size) {
                await this.retryOperation(
                    async () => {
                        fs.copyFileSync(storedPath, targetPath);
                    },
                    'Installation copy failed'
                );
                this.logger.logInfo(`Installed binding to ${targetPath}`);
            } else {
                this.logger.logInfo('Binding already installed.');
            }
        } catch (error) {
            telemetry.sendError(EVENT_BINDINGS_FAILED, {
                pkg
            });
            this.logger.logError(error, true);
            throw error;
        }
    }
}