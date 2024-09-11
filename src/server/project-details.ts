import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { Generator } from "./files/generator";

const projectDetailsFile = "project-details.json";

export type ProjectDetails = {
	description: string;
	version: string;
};

export class ProjectDetailsHandler {
	directory: string;

	constructor(
		private readonly workspace: string,
		private readonly generator?: Generator
	) {
		this.directory = path.join(__dirname, path.basename(workspace));
	}

	getProjectDetailsFileLocation = () => {
		return path.join(this.directory, projectDetailsFile);
	};

	locateLockFile = async () => {
		let lockFile: string = "";
		const files = await fs.promises.readdir(this.workspace);
		const lockFileNames = [
			"package-lock.json", // npm
			"yarn.lock", // Yarn
			"pnpm-lock.yaml", // pnpm
			"shrinkwrap.yaml", // npm shrinkwrap
		];

		for (const file of files) {
			if (lockFileNames.includes(file)) {
				lockFile = path.join(this.workspace, file);
				break; // Stop after finding the first lock file
			}
		}

		return lockFile;
	};

	generateProjectDetails = async () => {
		const projectDetailsPath = this.getProjectDetailsFileLocation();

		let packageJsonHash = "";
		if (fs.existsSync(path.join(this.workspace, "package.json"))) {
			const packageJson = fs.readFileSync(
				path.join(this.workspace, "package.json"),
				"utf8"
			);
			packageJsonHash = crypto
				.createHash("sha256")
				.update(packageJson)
				.digest("hex");

			const currentProjectDetails = await this.retrieveProjectDetails();

			if (currentProjectDetails?.version === packageJsonHash) {
				return;
			}

			const locateLockFile = await this.locateLockFile();

			const projectDetails =
				await this.generator?.generatorProjectSummary(
					packageJson,
					locateLockFile
				);

			// Ensure the directory exists
			await fs.promises.mkdir(path.dirname(projectDetailsPath), {
				recursive: true,
			});

			await fs.promises.writeFile(
				projectDetailsPath,
				JSON.stringify(
					{
						description: projectDetails,
						version: packageJsonHash,
					},
					null,
					2
				)
			);

			console.log("Project details generated:", projectDetailsPath);
		}
	};

	retrieveProjectDetails = async () => {
		try {
			const projectDetailsPath = this.getProjectDetailsFileLocation();
			if (fs.existsSync(projectDetailsPath)) {
				const projectDetails = await fs.promises.readFile(
					projectDetailsPath,
					"utf8"
				);
				return JSON.parse(projectDetails) as ProjectDetails;
			}
		} catch {}
	};
}
