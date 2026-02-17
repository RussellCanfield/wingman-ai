import { spawn } from "node:child_process";
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
import { findMissingBins } from "@/skills/bin-requirements.js";
import {
	parseSkillFrontmatter,
	type ParsedSkillFrontmatter,
	type SkillInstallRecipe,
} from "@/skills/metadata.js";

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
			const dependencyStatus =
				await this.handlePostInstallDependencyActivation(skillPath);

			if (this.outputManager.getMode() === "interactive") {
				console.log(
					`\n✓ Successfully installed skill ${skillName} to ${skillPath}`,
				);
				if (dependencyStatus) {
					console.log(`\n${dependencyStatus}`);
				}
			} else {
				this.outputManager.emitEvent({
					type: "skill-install-complete",
					skill: skillName,
					path: skillPath,
					timestamp: new Date().toISOString(),
				} as any);
				if (dependencyStatus) {
					this.outputManager.emitEvent({
						type: "log",
						level: "info",
						message: dependencyStatus,
						timestamp: new Date().toISOString(),
					} as any);
				}
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

	private async loadSkillFrontmatter(
		skillPath: string,
	): Promise<ParsedSkillFrontmatter> {
		const skillMdPath = path.join(skillPath, "SKILL.md");
		const content = await fs.readFile(skillMdPath, "utf-8");
		return parseSkillFrontmatter(content);
	}

	private resolveMissingRequiredBins(skill: ParsedSkillFrontmatter): string[] {
		const requiredBins = skill.runtimeMetadata?.requires.bins || [];
		return findMissingBins(requiredBins);
	}

	private selectInstallRecipe(
		skill: ParsedSkillFrontmatter,
		missingBins: string[],
	): SkillInstallRecipe | null {
		const installRecipes = skill.runtimeMetadata?.install || [];
		if (installRecipes.length === 0) return null;

		const missing = new Set(missingBins);
		const withMatchingBins = installRecipes.find((recipe) =>
			recipe.bins.some((bin) => missing.has(bin)),
		);
		return withMatchingBins || installRecipes[0] || null;
	}

	private async promptForDependencyInstall(
		skillName: string,
		missingBins: string[],
		recipe: SkillInstallRecipe,
	): Promise<boolean> {
		const commandPreview = this.getInstallCommandPreview(recipe);
		if (!commandPreview) return false;

		console.log(
			`Skill '${skillName}' is installed but inactive. Missing required binaries: ${missingBins.join(", ")}`,
		);
		console.log(`Install option (${recipe.kind}): ${commandPreview}`);

		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		try {
			const answer = await rl.question("Run install command now? (y/N): ");
			const normalized = answer.trim().toLowerCase();
			return normalized === "y" || normalized === "yes";
		} finally {
			rl.close();
		}
	}

	private getInstallCommandPreview(recipe: SkillInstallRecipe): string | null {
		if (recipe.kind === "brew" && recipe.formula) {
			return `brew install ${recipe.formula}`;
		}
		return null;
	}

	private async runInstallRecipe(recipe: SkillInstallRecipe): Promise<void> {
		if (recipe.kind !== "brew" || !recipe.formula) {
			throw new Error(
				`Unsupported install recipe kind '${recipe.kind}'. Currently supported: brew`,
			);
		}

		await new Promise<void>((resolve, reject) => {
			const child = spawn("brew", ["install", recipe.formula as string], {
				cwd: this.workspace,
				stdio: "inherit",
			});
			child.on("error", (error) => reject(error));
			child.on("exit", (code) => {
				if (code === 0) {
					resolve();
					return;
				}
				reject(new Error(`Install command exited with code ${code}`));
			});
		});
	}

	private async handlePostInstallDependencyActivation(
		skillPath: string,
	): Promise<string | null> {
		const skill = await this.loadSkillFrontmatter(skillPath);
		if (!skill.runtimeMetadata) {
			return null;
		}

		const missingBins = this.resolveMissingRequiredBins(skill);
		if (missingBins.length === 0) {
			return `Skill '${skill.name}' is active.`;
		}

		const installRecipe = this.selectInstallRecipe(skill, missingBins);
		const outputMode = this.outputManager.getMode();
		if (!installRecipe || outputMode !== "interactive") {
			return `Skill '${skill.name}' remains inactive until required binaries are available: ${missingBins.join(", ")}`;
		}

		const confirmed = await this.promptForDependencyInstall(
			skill.name,
			missingBins,
			installRecipe,
		);
		if (!confirmed) {
			return `Skill '${skill.name}' remains inactive until required binaries are available: ${missingBins.join(", ")}`;
		}

		await this.runInstallRecipe(installRecipe);
		const remainingMissingBins = this.resolveMissingRequiredBins(skill);
		if (remainingMissingBins.length === 0) {
			return `Skill '${skill.name}' is now active.`;
		}
		return `Skill '${skill.name}' is still inactive. Missing binaries: ${remainingMissingBins.join(", ")}`;
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
		const parsed = parseSkillFrontmatter(content);
		return { name: parsed.name, description: parsed.description };
	}
}
