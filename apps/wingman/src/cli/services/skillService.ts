import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import type {
	InstalledSkill,
	SkillSecurityOptions,
	SkillServiceOptions,
} from "../types/skill.js";
import type { SkillRepository } from "./skillRepository.js";
import type { OutputManager } from "../core/outputManager.js";
import { getLogFilePath, type Logger } from "../../logger.js";
import { scanSkillDirectory } from "./skillSecurityScanner.js";

export class SkillService {
	private readonly workspace: string;
	private readonly skillsDirectory: string;
	private readonly repository: SkillRepository;
	private readonly outputManager: OutputManager;
	private readonly logger: Logger;
	private readonly security: SkillSecurityOptions;

	constructor(
		repository: SkillRepository,
		outputManager: OutputManager,
		logger: Logger,
		options: SkillServiceOptions,
	) {
		this.repository = repository;
		this.outputManager = outputManager;
		this.logger = logger;
		this.workspace = options.workspace;
		this.skillsDirectory = options.skillsDirectory || "skills";
		this.security = options.security || {};
	}

	/**
	 * Get the absolute path to the skills directory
	 */
	private getSkillsPath(): string {
		return path.join(this.workspace, this.skillsDirectory);
	}

	/**
	 * Browse available skills from the repository
	 */
	async browseSkills(): Promise<void> {
		try {
			this.logger.info("Fetching available skills from repository...");

			const skills = await this.repository.listAvailableSkills();

			if (this.outputManager.getMode() === "interactive") {
				console.log("\nAvailable Skills:");
				console.log("=================\n");

				if (skills.length === 0) {
					console.log("No skills found.");
				} else {
					for (const skill of skills) {
						console.log(`  ${skill.name}`);
						console.log(`    ${skill.description}`);
						console.log();
					}

					console.log(
						`\nTo install a skill, run: wingman skill install <skill-name>`,
					);
				}
			} else {
				// JSON mode
				this.outputManager.emitEvent({
					type: "skill-browse",
					skills: skills.map((s) => ({
						name: s.name,
						description: s.description,
					})),
					timestamp: new Date().toISOString(),
				} as any);
			}
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			const logFile = getLogFilePath();
			this.logger.error(`Failed to browse skills: ${errorMsg}`);

			if (this.outputManager.getMode() === "interactive") {
				console.error(`\nError: ${errorMsg}`);
				console.error(`Logs: ${logFile}`);
			} else {
				this.outputManager.emitEvent({
					type: "agent-error",
					error: errorMsg,
					logFile,
					timestamp: new Date().toISOString(),
				});
			}

			throw error;
		}
	}

	/**
	 * Install a skill from the repository
	 */
	async installSkill(skillName: string): Promise<void> {
		let stagingRoot: string | null = null;
		let shouldReplaceExisting = false;
		try {
			// Validate skill name format
			const nameRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
			if (!nameRegex.test(skillName)) {
				throw new Error(
					`Invalid skill name '${skillName}': must be lowercase alphanumeric with hyphens only`,
				);
			}

			this.logger.info(`Installing skill: ${skillName}`);

			const skillPath = path.join(this.getSkillsPath(), skillName);

			// Check if skill already exists
			const exists = await this.skillExists(skillName);
			if (exists) {
				if (this.outputManager.getMode() === "interactive") {
					// Prompt for overwrite confirmation
					const shouldOverwrite = await this.promptForOverwrite(
						skillName,
					);
					if (!shouldOverwrite) {
						console.log("\nInstallation cancelled.");
						return;
					}
					shouldReplaceExisting = true;
				} else {
					// JSON mode - fail with error
					throw new Error(
						`Skill '${skillName}' is already installed.`,
					);
				}
			}

			// Fetch skill metadata to validate it exists
			this.logger.info("Fetching skill metadata...");
			const metadata = await this.repository.getSkillMetadata(skillName);

			if (this.outputManager.getMode() === "interactive") {
				console.log(`\nInstalling skill: ${metadata.name}`);
				console.log(`Description: ${metadata.description}`);
			} else {
				this.outputManager.emitEvent({
					type: "skill-install-progress",
					skill: skillName,
					status: "downloading",
					timestamp: new Date().toISOString(),
				} as any);
			}

			// Download all skill files
			this.logger.info("Downloading skill files...");
			const files = await this.repository.downloadSkill(skillName);
			stagingRoot = await fs.mkdtemp(path.join(tmpdir(), "wingman-skill-"));
			const stagedSkillPath = path.join(stagingRoot, skillName);
			await fs.mkdir(stagedSkillPath, { recursive: true });

			// Write all files to staging before validation + scanning.
			this.logger.info(`Writing ${files.size} files to staging...`);
			for (const [relativePath, content] of files) {
				const filePath = this.resolveSafeInstallPath(
					stagedSkillPath,
					relativePath,
				);
				const fileDir = path.dirname(filePath);

				// Ensure subdirectories exist
				await fs.mkdir(fileDir, { recursive: true });

				// Write file
				await fs.writeFile(filePath, content);
			}

			await this.validateSkillMd(stagedSkillPath);
			await scanSkillDirectory(stagedSkillPath, this.logger, this.security);

			// Ensure skills directory exists
			await fs.mkdir(this.getSkillsPath(), { recursive: true });

			if (shouldReplaceExisting) {
				this.logger.info("Replacing existing skill...");
				await fs.rm(skillPath, { recursive: true, force: true });
			}

			// Create skill directory and copy validated content.
			await fs.mkdir(skillPath, { recursive: true });
			await fs.cp(stagedSkillPath, skillPath, { recursive: true, force: true });

			if (this.outputManager.getMode() === "interactive") {
				console.log(
					`\n✓ Successfully installed skill ${skillName} to ${skillPath}`,
				);
			} else {
				this.outputManager.emitEvent({
					type: "skill-install-complete",
					skill: skillName,
					path: skillPath,
					timestamp: new Date().toISOString(),
				} as any);
			}
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			const logFile = getLogFilePath();
			this.logger.error(`Failed to install skill: ${errorMsg}`);

			if (this.outputManager.getMode() === "interactive") {
				console.error(`\nError: ${errorMsg}`);
				console.error(`Logs: ${logFile}`);
			} else {
				this.outputManager.emitEvent({
					type: "agent-error",
					error: errorMsg,
					logFile,
					timestamp: new Date().toISOString(),
				});
			}

			throw error;
		} finally {
			if (stagingRoot) {
				await fs.rm(stagingRoot, { recursive: true, force: true });
			}
		}
	}

	/**
	 * List installed skills
	 */
	async listInstalledSkills(): Promise<void> {
		try {
			const skillsPath = this.getSkillsPath();

			// Check if skills directory exists
			try {
				await fs.access(skillsPath);
			} catch {
				if (this.outputManager.getMode() === "interactive") {
					console.log("\nNo skills installed.");
				} else {
					this.outputManager.emitEvent({
						type: "skill-list",
						skills: [],
						timestamp: new Date().toISOString(),
					} as any);
				}
				return;
			}

			// Read skills directory
			const entries = await fs.readdir(skillsPath, {
				withFileTypes: true,
			});
			const skillDirs = entries.filter((entry) => entry.isDirectory());

			if (skillDirs.length === 0) {
				if (this.outputManager.getMode() === "interactive") {
					console.log("\nNo skills installed.");
				} else {
					this.outputManager.emitEvent({
						type: "skill-list",
						skills: [],
						timestamp: new Date().toISOString(),
					} as any);
				}
				return;
			}

			// Read metadata for each skill
			const skills: InstalledSkill[] = [];
			for (const dir of skillDirs) {
				const skillPath = path.join(skillsPath, dir.name);
				const skillMdPath = path.join(skillPath, "SKILL.md");

				try {
					const content = await fs.readFile(skillMdPath, "utf-8");
					const metadata = this.parseSkillMetadata(content);
					skills.push({
						name: metadata.name,
						description: metadata.description,
						path: skillPath,
					});
				} catch {
					// Skip invalid skills
					this.logger.warn(
						`Skipping invalid skill directory: ${dir.name}`,
					);
				}
			}

			if (this.outputManager.getMode() === "interactive") {
				console.log("\nInstalled Skills:");
				console.log("=================\n");

				for (const skill of skills) {
					console.log(`  ${skill.name}`);
					console.log(`    ${skill.description}`);
					console.log(`    Location: ${skill.path}`);
					console.log();
				}
			} else {
				this.outputManager.emitEvent({
					type: "skill-list",
					skills: skills.map((s) => ({
						name: s.name,
						description: s.description,
						path: s.path,
					})),
					timestamp: new Date().toISOString(),
				} as any);
			}
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			const logFile = getLogFilePath();
			this.logger.error(`Failed to list skills: ${errorMsg}`);

			if (this.outputManager.getMode() === "interactive") {
				console.error(`\nError: ${errorMsg}`);
				console.error(`Logs: ${logFile}`);
			} else {
				this.outputManager.emitEvent({
					type: "agent-error",
					error: errorMsg,
					logFile,
					timestamp: new Date().toISOString(),
				});
			}

			throw error;
		}
	}

	/**
	 * Remove an installed skill
	 */
	async removeSkill(skillName: string): Promise<void> {
		try {
			const skillPath = path.join(this.getSkillsPath(), skillName);

			// Check if skill exists
			const exists = await this.skillExists(skillName);
			if (!exists) {
				throw new Error(`Skill '${skillName}' is not installed.`);
			}

			this.logger.info(`Removing skill: ${skillName}`);

			// Remove skill directory
			await fs.rm(skillPath, { recursive: true, force: true });

			if (this.outputManager.getMode() === "interactive") {
				console.log(`\n✓ Successfully removed skill ${skillName}`);
			} else {
				this.outputManager.emitEvent({
					type: "skill-remove",
					skill: skillName,
					timestamp: new Date().toISOString(),
				} as any);
			}
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			const logFile = getLogFilePath();
			this.logger.error(`Failed to remove skill: ${errorMsg}`);

			if (this.outputManager.getMode() === "interactive") {
				console.error(`\nError: ${errorMsg}`);
				console.error(`Logs: ${logFile}`);
			} else {
				this.outputManager.emitEvent({
					type: "agent-error",
					error: errorMsg,
					logFile,
					timestamp: new Date().toISOString(),
				});
			}

			throw error;
		}
	}

	/**
	 * Check if a skill exists locally
	 */
	private async skillExists(skillName: string): Promise<boolean> {
		const skillPath = path.join(this.getSkillsPath(), skillName);
		try {
			await fs.access(skillPath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Prompt user for overwrite confirmation
	 */
	private async promptForOverwrite(skillName: string): Promise<boolean> {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		try {
			const answer = await rl.question(
				`\nSkill ${skillName} is already installed. Overwrite? (y/N): `,
			);
			return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
		} finally {
			rl.close();
		}
	}

	/**
	 * Validate SKILL.md file
	 */
	private async validateSkillMd(skillPath: string): Promise<void> {
		const skillMdPath = path.join(skillPath, "SKILL.md");

		try {
			const content = await fs.readFile(skillMdPath, "utf-8");
			this.parseSkillMetadata(content);
		} catch (error) {
			throw new Error(
				`Invalid SKILL.md: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private resolveSafeInstallPath(root: string, relativePath: string): string {
		const normalized = path.posix
			.normalize(relativePath.replace(/\\/g, "/"))
			.replace(/^\/+/, "");
		if (!normalized || normalized === "." || normalized.startsWith("../")) {
			throw new Error(
				`Unsafe skill file path '${relativePath}' rejected during installation`,
			);
		}

		const rootResolved = path.resolve(root);
		const filePath = path.resolve(rootResolved, normalized);
		if (
			filePath !== rootResolved &&
			!filePath.startsWith(rootResolved + path.sep)
		) {
			throw new Error(
				`Unsafe skill file path '${relativePath}' rejected during installation`,
			);
		}

		return filePath;
	}

	/**
	 * Parse SKILL.md metadata (same logic as repository)
	 */
	private parseSkillMetadata(content: string): {
		name: string;
		description: string;
	} {
		const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
		const match = content.match(frontmatterRegex);

		if (!match) {
			throw new Error(
				"Invalid SKILL.md format: missing YAML frontmatter",
			);
		}

		const frontmatter = match[1];
		let name = "";
		let description = "";

		const lines = frontmatter.split("\n");
		for (const line of lines) {
			const colonIndex = line.indexOf(":");
			if (colonIndex === -1) continue;

			const key = line.substring(0, colonIndex).trim();
			const value = line.substring(colonIndex + 1).trim();

			if (key === "name") {
				name = value;
			} else if (key === "description") {
				description = value;
			}
		}

		if (!name) {
			throw new Error("missing required field 'name'");
		}
		if (!description) {
			throw new Error("missing required field 'description'");
		}

		return { name, description };
	}
}
