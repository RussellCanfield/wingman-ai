const path = require("node:path");
const fs = require("node:fs");
const tar = require("tar");

const packages = [
	"@ast-grep/napi-win32-x64-msvc",
	"@ast-grep/napi-win32-arm64-msvc",
	"@ast-grep/napi-darwin-arm64",
	"@ast-grep/napi-darwin-x64",
	"@ast-grep/napi-linux-x64-gnu",
	"@ast-grep/napi-linux-arm64-gnu",
	"@ast-grep/napi-linux-x64-musl",
	"@ast-grep/napi-linux-arm64-musl",
	"@ast-grep/napi-linux-arm-gnueabihf",
	"@ast-grep/napi-linux-arm-musleabihf",
	"@ast-grep/napi-freebsd-x64",
	"@ast-grep/napi-alpine-x64-musl",
	"@ast-grep/napi-alpine-arm64-musl",
];

const downloadAndExtract = async (pkg, outDir) => {
	const { default: fetch } = await import("node-fetch");
	const url = `https://registry.npmjs.org/${pkg}/-/${pkg
		.split("/")
		.pop()}-0.36.1.tgz`;
	console.log(`Downloading ${pkg} from ${url}`);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download ${pkg}: ${response.statusText}`);
	}

	const buffer = await response.arrayBuffer();
	const outputDir = path.join(outDir, "tmp", pkg.replace("/", "-"));

	// Ensure the output directory is empty
	if (fs.existsSync(outputDir)) {
		fs.rmSync(outputDir, { recursive: true, force: true });
	}
	fs.mkdirSync(outputDir, { recursive: true });

	// Save the buffer to a file
	const tarballPath = path.join(outputDir, `${pkg.split("/").pop()}.tgz`);
	console.log("Creating:", tarballPath);
	fs.writeFileSync(tarballPath, Buffer.from(buffer));

	// Extract the tarball
	await tar.x({
		file: tarballPath,
		cwd: outputDir,
	});

	console.log(`Extracted ${pkg} to ${outputDir}`);

	const packageDir = path.join(outputDir, "package");
	const files = fs.readdirSync(packageDir);
	for (const file of files) {
		if (file.endsWith(".node")) {
			const srcPath = path.join(packageDir, file);
			const destPath = path.join(outDir, file);
			fs.copyFileSync(srcPath, destPath);
			console.log(`Copied ${file} to ${destPath}`);
		}
	}

	// Clean up temporary directory
	fs.rmSync(outputDir, { recursive: true, force: true });
};

const run = async (outDir) => {
	for (const pkg of packages) {
		try {
			await downloadAndExtract(pkg, outDir);
		} catch (error) {
			console.error(`Failed to process ${pkg}:`, error);
		}
	}
};

run(path.join(__dirname, "..", "node_modules", "@ast-grep", "napi"));
