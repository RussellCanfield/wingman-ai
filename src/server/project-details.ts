import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { Generator } from "./files/generator";
import os from "node:os";

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
		const homeDir = os.homedir();
		this.directory = path.join(
			homeDir,
			".wingman",
			path.basename(this.workspace)
		);
		fs.mkdirSync(this.directory, { recursive: true });
	}

	getProjectDetailsFileLocation = () => {
		return path.join(this.directory, projectDetailsFile);
	};

	locateMainConfigFile = async () => {
		const files = await fs.promises.readdir(this.workspace);
		const configFiles = {
			"package.json": "javascript", // npm, yarn, pnpm
			"composer.json": "php",
			// Add other main config files here if needed
		};

		for (const [file, language] of Object.entries(configFiles)) {
			if (files.includes(file)) {
				return {
					path: path.join(this.workspace, file),
					language,
				};
			}
		}

		return null;
	};

	locateDependencyFile = async () => {
		const files = await fs.promises.readdir(this.workspace);
		const dependencyFiles = [
			"package-lock.json", // npm
			"yarn.lock", // Yarn
			"pnpm-lock.yaml", // pnpm
			"shrinkwrap.yaml", // npm shrinkwrap
			"composer.lock", // PHP Composer
			// Add other dependency files here if needed
		];

		for (const file of dependencyFiles) {
			if (files.includes(file)) {
				return file; // Return just the filename
			}
		}

		return null;
	};

	generateProjectDetails = async () => {
		try {
			const projectDetailsPath = this.getProjectDetailsFileLocation();

			const mainConfigFile = await this.locateMainConfigFile();
			if (!mainConfigFile) {
				console.log("No main configuration file found.");
				return;
			}

			const configContent = fs.readFileSync(mainConfigFile.path, "utf8");
			const configHash = crypto
				.createHash("sha256")
				.update(configContent)
				.digest("hex");

			const currentProjectDetails = await this.retrieveProjectDetails();

			if (currentProjectDetails?.version === configHash) {
				return;
			}

			const dependencyFileName = await this.locateDependencyFile();

			const projectDetails =
				await this.generator?.generatorProjectSummary(
					configContent,
					mainConfigFile.language,
					dependencyFileName
				);

			await fs.promises.mkdir(path.dirname(projectDetailsPath), {
				recursive: true,
			});

			await fs.promises.writeFile(
				projectDetailsPath,
				JSON.stringify(
					{
						description: projectDetails,
						version: configHash,
					},
					null,
					2
				)
			);

			console.log("Project details generated:", projectDetailsPath);
		} catch (e) {
			console.error("Unable to generate project details", e);
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
