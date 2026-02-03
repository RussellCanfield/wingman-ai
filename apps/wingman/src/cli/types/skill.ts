import type { OutputMode } from "../types.js";
import type { LogLevel } from "../../logger.js";

/**
 * Skill metadata parsed from SKILL.md frontmatter
 */
export interface SkillMetadata {
	name: string;
	description: string;
	license?: string;
	compatibility?: string;
	metadata?: Record<string, string>;
	allowedTools?: string;
}

/**
 * Skill information with additional context
 */
export interface SkillInfo {
	name: string;
	description: string;
	path: string;
	metadata?: SkillMetadata;
}

/**
 * Installed skill information
 */
export interface InstalledSkill {
	name: string;
	description: string;
	path: string;
}

/**
 * GitHub API response for directory contents
 */
export interface GitHubContentItem {
	name: string;
	path: string;
	sha: string;
	size: number;
	url: string;
	html_url: string;
	git_url: string;
	download_url: string | null;
	type: "file" | "dir";
	content?: string;
	encoding?: string;
}

/**
 * Command arguments for skill commands
 */
export interface SkillCommandArgs {
	subcommand: string;
	args: string[];
	verbosity: LogLevel;
	outputMode: OutputMode;
}

/**
 * Options for skill repository operations
 */
export interface SkillRepositoryOptions {
	repositoryOwner?: string;
	repositoryName?: string;
	githubToken?: string;
}

/**
 * Options for skill service operations
 */
export interface SkillServiceOptions {
	workspace: string;
	skillsDirectory?: string;
	outputMode: OutputMode;
}
