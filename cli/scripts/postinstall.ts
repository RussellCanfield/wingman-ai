 
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as tar from "tar";
import * as yauzl from "yauzl";
import { Readable } from "node:stream";
import * as zlib from "node:zlib";

const BIN_DIR = path.resolve(__dirname, "..", "bin");

const OMNISHARP_VERSION = "v1.39.13";
const RUST_ANALYZER_VERSION = "2025-06-16";

const omnisharpBaseUrl = `https://github.com/OmniSharp/omnisharp-roslyn/releases/download/${OMNISHARP_VERSION}`;
const rustAnalyzerBaseUrl = `https://github.com/rust-lang/rust-analyzer/releases/download/${RUST_ANALYZER_VERSION}`;

const platform = os.platform();
const arch = os.arch();

function getOmniSharpUrl(): string | null {
    // Use self-contained .net6.0 builds for reliability
    if (platform === 'linux' && arch === 'arm64') {
        return `${omnisharpBaseUrl}/omnisharp-linux-arm64-net6.0.tar.gz`;
    }
    if (platform === 'linux' && arch === 'x64') {
        return `${omnisharpBaseUrl}/omnisharp-linux-x64-net6.0.tar.gz`;
    }
    if (platform === 'darwin' && arch === 'arm64') {
        return `${omnisharpBaseUrl}/omnisharp-osx-arm64-net6.0.tar.gz`;
    }
    if (platform === 'darwin' && arch === 'x64') {
        return `${omnisharpBaseUrl}/omnisharp-osx-x64-net6.0.tar.gz`;
    }
    if (platform === 'win32' && arch === 'arm64') {
        return `${omnisharpBaseUrl}/omnisharp-win-arm64-net6.0.zip`;
    }
    if (platform === 'win32' && arch === 'x64') {
        return `${omnisharpBaseUrl}/omnisharp-win-x64-net6.0.zip`;
    }

	// Return null if no suitable binary is found
	return null;
}

function getRustAnalyzerUrl(): string | null {
	switch (`${platform}-${arch}`) {
		// macOS
		case "darwin-arm64":
			return `${rustAnalyzerBaseUrl}/rust-analyzer-aarch64-apple-darwin.gz`;
		case "darwin-x64":
			return `${rustAnalyzerBaseUrl}/rust-analyzer-x86_64-apple-darwin.gz`;

		// Linux
		case "linux-arm64":
			return `${rustAnalyzerBaseUrl}/rust-analyzer-aarch64-unknown-linux-gnu.gz`;
		case "linux-x64":
			return `${rustAnalyzerBaseUrl}/rust-analyzer-x86_64-unknown-linux-gnu.gz`;

		// Windows
		case "win32-arm64":
			return `${rustAnalyzerBaseUrl}/rust-analyzer-aarch64-pc-windows-msvc.zip`;
		case "win32-x64":
			return `${rustAnalyzerBaseUrl}/rust-analyzer-x86_64-pc-windows-msvc.zip`;
        case "win32-ia32":
            return `${rustAnalyzerBaseUrl}/rust-analyzer-i686-pc-windows-msvc.zip`;

		default:
			return null;
	}
}

async function downloadAndExtract(url: string, dest: string) {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	const fileName = path.basename(url);
	const filePath = path.join(dest, fileName);

	console.log(`Downloading ${url}...`);
	const response = await fetch(url, {
		method: "GET",
	});

	if (!response.ok || !response.body) {
		throw new Error(`Failed to download file: ${response.statusText}`);
	}

	const writer = fs.createWriteStream(filePath);
	const readable = Readable.fromWeb(response.body as any);

	readable.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on("finish", async () => {
			console.log(`Extracting ${fileName}...`);
			try {
				if (fileName.endsWith(".zip")) {
					yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
						if (err) reject(err);
						zipfile.readEntry();
						zipfile.on("entry", (entry) => {
							const entryPath = path.join(dest, entry.fileName);
							if (/\/$/.test(entry.fileName)) {
								fs.mkdirSync(entryPath, { recursive: true });
								zipfile.readEntry();
							} else {
								zipfile.openReadStream(entry, (err, readStream) => {
									if (err) reject(err);
									const writeStream = fs.createWriteStream(entryPath);
									readStream.pipe(writeStream);
									writeStream.on("finish", () => {
										if (platform !== 'win32' && (entry.fileName === 'run' || entry.fileName === 'rust-analyzer')) {
											fs.chmodSync(entryPath, 0o755);
										}
										zipfile.readEntry()
									});
								});
							}
						});
						zipfile.on("end", () => {
							fs.unlinkSync(filePath); // Clean up the zip file
							resolve(void 0);
						});
					});
				} else if (fileName.endsWith(".tar.gz")) {
					await tar.x({
						file: filePath,
						cwd: dest,
						strip: 1,
					});
					fs.unlinkSync(filePath); // Clean up the tarball
					if (platform !== 'win32') {
						const runScriptPath = path.join(dest, 'run');
						if (fs.existsSync(runScriptPath)) {
							fs.chmodSync(runScriptPath, 0o755);
						}
					}
					resolve(void 0);
				} else if (fileName.endsWith(".gz")) {
					const executableName = 'rust-analyzer';
					const outputPath = path.join(dest, executableName);
					const readStream = fs.createReadStream(filePath);
					const writeStream = fs.createWriteStream(outputPath);
					const gunzip = zlib.createGunzip();
			
					readStream.pipe(gunzip).pipe(writeStream);
			
					writeStream.on('finish', () => {
						fs.unlinkSync(filePath); // Clean up the gz file
						if (platform !== 'win32') {
							fs.chmodSync(outputPath, 0o755); // Make it executable
						}
						resolve(void 0);
					});
					writeStream.on('error', reject);
					readStream.on('error', reject);
					gunzip.on('error', reject);
				}
			} catch (error) {
				reject(error);
			}
		});
		writer.on("error", reject);
	});
}

async function main() {
	console.log(`Platform: ${platform}, Arch: ${arch}`);

	const omnisharpUrl = getOmniSharpUrl();
	if (omnisharpUrl) {
		await downloadAndExtract(omnisharpUrl, path.join(BIN_DIR, "omnisharp"));
		console.log("OmniSharp downloaded and extracted.");
	} else {
		console.warn("OmniSharp is not available for this platform/architecture.");
	}

	const rustAnalyzerUrl = getRustAnalyzerUrl();
	if (rustAnalyzerUrl) {
		await downloadAndExtract(
			rustAnalyzerUrl,
			path.join(BIN_DIR, "rust-analyzer"),
		);
		console.log("Rust Analyzer downloaded and extracted.");
	} else {
		console.warn(
			"Rust Analyzer is not available for this platform/architecture.",
		);
	}
}

main().catch((error) => {
	console.error("Failed to download LSPs:", error);
	process.exit(1);
});
