/*
	Download pre-built Llama cpp binaries from the node-llama-cpp npm package.
*/

const https = require("https");
const tar = require("tar");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");

const url =
	"https://registry.npmjs.org/node-llama-cpp/-/node-llama-cpp-2.8.2.tgz";
const filePath = path.resolve(`${process.cwd()}/node-llama-cpp-2.8.2.tgz`);

const file = fs.createWriteStream(filePath);

async function copyDir(src, dest) {
	fs.mkdirSync(dest, { recursive: true });

	let entries = fs.readdirSync(src, { withFileTypes: true });

	for (let entry of entries) {
		let srcPath = path.join(src, entry.name);
		let destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			await copyDir(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

https
	.get(url, (response) => {
		response.pipe(file);

		file.on("finish", () => {
			file.close(() => {
				console.log("Download completed");
				console.log("Extracting tarball...");

				tar.extract({
					file: filePath,
					cwd: process.cwd(),
				})
					.then(() => {
						const sourcePath = path.resolve(
							`${process.cwd()}/package/llamaBins`
						);
						const destinationPath = path.resolve(
							`${process.cwd()}/llamaBins`
						);

						copyDir(sourcePath, destinationPath)
							.then(() => {
								fsp.rm(filePath);
								fsp.rm(
									path.resolve(`${process.cwd()}/package`)
								);
								fsp.rm(sourcePath, {
									recursive: true,
									force: true,
								});
								console.log("Done!");
							})
							.catch((error) => {
								console.error(
									"Error copying directory:",
									error
								);
							});
					})
					.catch((error) => {
						console.error("Error extracting tarball:", error);
					});
			});
		});
	})
	.on("error", (error) => {
		console.error("Error downloading tarball:", error);
	});
