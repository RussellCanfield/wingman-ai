import type {
	GitHubContentItem,
	SkillGitHubRepository,
	SkillInfo,
	SkillMetadata,
	SkillRepositoryOptions,
} from "../types/skill.js";
import { createLogger } from "@/logger.js";
import { parseSkillFrontmatter } from "@/skills/metadata.js";

const logger = createLogger();

type ClawHubSkillListItem = {
	slug: string;
	displayName?: string;
	summary?: string | null;
	latestVersion?: {
		version?: string;
	};
};

type ClawHubSkillListResponse = {
	items?: ClawHubSkillListItem[];
};

type ClawHubSkillDetailResponse = {
	skill?: {
		slug?: string;
		displayName?: string;
		summary?: string | null;
	};
	latestVersion?: {
		version?: string;
		changelog?: string;
		createdAt?: number;
	};
	owner?: {
		handle?: string | null;
		userId?: string | null;
		displayName?: string | null;
	};
	moderation?: {
		isSuspicious?: boolean;
		isMalwareBlocked?: boolean;
	} | null;
};

type ClawHubVersionFilesResponse = {
	version?: {
		version?: string;
		files?: Array<{
			path: string;
			sha256?: string;
			size?: number;
		}>;
	};
};

/**
 * GitHub API client for interacting with the skills repository
 */
export class SkillRepository {
	private readonly githubBaseUrl = "https://api.github.com";
	private readonly repositories: SkillGitHubRepository[];
	private readonly token?: string;
	private readonly provider: "github" | "clawhub" | "hybrid";
	private readonly clawhubBaseUrl: string;

	constructor(options: SkillRepositoryOptions = {}) {
		this.provider = options.provider || "hybrid";
		const normalizedRepositories = (options.repositories || [])
			.map((repository) => ({
				owner: repository.owner.trim(),
				name: repository.name.trim(),
			}))
			.filter((repository) => repository.owner && repository.name);
		const legacyOwner = options.repositoryOwner?.trim();
		const legacyName = options.repositoryName?.trim();

		if (normalizedRepositories.length > 0) {
			this.repositories = normalizedRepositories;
		} else if (legacyOwner && legacyName) {
			this.repositories = [
				{
					owner: legacyOwner,
					name: legacyName,
				},
			];
		} else {
			this.repositories = [];
		}
		this.token =
			options.githubToken || process.env.GITHUB_TOKEN || undefined;
		this.clawhubBaseUrl = (
			options.clawhubBaseUrl || "https://clawhub.ai"
		).replace(/\/+$/, "");
	}

	/**
	 * Fetch data from GitHub API
	 */
	private async fetchGitHub<T>(path: string): Promise<T> {
		const url = `${this.githubBaseUrl}${path}`;
		const headers: Record<string, string> = {
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "wingman-cli",
		};

		if (this.token) {
			headers.Authorization = `Bearer ${this.token}`;
		}

		const response = await fetch(url, { headers });

		if (!response.ok) {
			if (response.status === 403) {
				const resetTime = response.headers.get("X-RateLimit-Reset");
				const resetDate = resetTime
					? new Date(Number.parseInt(resetTime) * 1000)
					: null;
				throw new Error(
					`GitHub API rate limit exceeded. ${
						resetDate
							? `Resets at ${resetDate.toLocaleString()}.`
							: ""
					} Set GITHUB_TOKEN environment variable for higher limits (5000/hour vs 60/hour).`,
				);
			}

			if (response.status === 404) {
				throw new Error(`Resource not found: ${path}`);
			}

			throw new Error(
				`GitHub API error: ${response.status} ${response.statusText}`,
			);
		}

		return response.json() as Promise<T>;
	}

	/**
	 * List available skills from the repository
	 */
	async listAvailableSkills(): Promise<SkillInfo[]> {
		try {
			if (this.provider === "clawhub") {
				return await this.listSkillsFromClawhub();
			}
			if (this.provider === "github") {
				return await this.listSkillsFromGitHub();
			}
			return await this.listSkillsFromHybrid();
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to list skills: ${error.message}`);
			}
			throw error;
		}
	}

	private async fetchJson<T>(
		url: string,
		options?: { headers?: Record<string, string> },
	): Promise<T> {
		const response = await fetch(url, {
			headers: options?.headers,
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} ${response.statusText}`);
		}
		return (await response.json()) as T;
	}

	private async fetchBinary(
		url: string,
		options?: { headers?: Record<string, string> },
	): Promise<Buffer> {
		const response = await fetch(url, {
			headers: options?.headers,
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} ${response.statusText}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		return Buffer.from(arrayBuffer);
	}

	/**
	 * Get skill metadata by fetching and parsing SKILL.md
	 */
	async getSkillMetadata(skillName: string): Promise<SkillMetadata> {
		try {
			if (this.provider === "clawhub") {
				return await this.getClawhubSkillMetadata(skillName);
			}
			if (this.provider === "github") {
				const repository = await this.resolveGitHubRepositoryForSkill(skillName);
				return await this.getGitHubSkillMetadata(skillName, repository);
			}
			return await this.getHybridSkillMetadata(skillName);
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to fetch skill metadata for ${skillName}: ${error.message}`,
				);
			}
			throw error;
		}
	}

	private async getGitHubSkillMetadata(
		skillName: string,
		repository: SkillGitHubRepository,
	): Promise<SkillMetadata> {
		const skillMdPath = `/repos/${repository.owner}/${repository.name}/contents/skills/${skillName}/SKILL.md`;
		const skillMd = await this.fetchGitHub<GitHubContentItem>(skillMdPath);
		if (skillMd.type !== "file" || !skillMd.content) {
			throw new Error(
				`SKILL.md not found or invalid in ${repository.owner}/${repository.name}`,
			);
		}

		// Decode base64 content
		const content = Buffer.from(skillMd.content, "base64").toString(
			"utf-8",
		);
		return this.parseSkillMetadata(content);
	}

	private async resolveGitHubRepositoryForSkill(
		skillName: string,
	): Promise<SkillGitHubRepository> {
		const repositories = this.getGitHubRepositories();
		for (let index = repositories.length - 1; index >= 0; index -= 1) {
			const repository = repositories[index];
			try {
				await this.fetchGitHub<GitHubContentItem>(
					`/repos/${repository.owner}/${repository.name}/contents/skills/${skillName}/SKILL.md`,
				);
				return repository;
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes("Resource not found")
				) {
					continue;
				}
				throw error;
			}
		}
		throw new Error(
			`Skill '${skillName}' not found in configured GitHub repositories: ${repositories
				.map((repository) => `${repository.owner}/${repository.name}`)
				.join(", ")}`,
		);
	}

	private async getClawhubSkillMetadata(
		skillName: string,
	): Promise<SkillMetadata> {
		try {
			const detail = await this.fetchJson<ClawHubSkillDetailResponse>(
				`${this.clawhubBaseUrl}/api/v1/skills/${encodeURIComponent(skillName)}`,
				{
					headers: {
						Accept: "application/json",
						"User-Agent": "wingman-cli",
					},
				},
			);
			const slug = detail.skill?.slug?.trim() || skillName.trim();
			const description =
				detail.skill?.summary?.trim() ||
				detail.skill?.displayName?.trim() ||
				"No description";
			const nameRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
			if (!nameRegex.test(slug)) {
				throw new Error(
					`Invalid skill name '${slug}': must be lowercase alphanumeric with hyphens only`,
				);
			}
			return {
				name: slug,
				description,
				metadata: {
					...(detail.latestVersion?.version
						? { version: detail.latestVersion.version }
						: {}),
					...(detail.owner?.handle ? { owner: detail.owner.handle } : {}),
				},
			};
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to fetch skill metadata for ${skillName}: ${error.message}`,
				);
			}
			throw error;
		}
	}

	private async getHybridSkillMetadata(
		skillName: string,
	): Promise<SkillMetadata> {
		let githubError: unknown;
		try {
			const repository = await this.resolveGitHubRepositoryForSkill(skillName);
			return await this.getGitHubSkillMetadata(skillName, repository);
		} catch (error) {
			githubError = error;
			logger.debug(
				`Falling back to ClawHub metadata lookup for '${skillName}' after GitHub error: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}

		try {
			return await this.getClawhubSkillMetadata(skillName);
		} catch (clawhubError) {
			throw new Error(
				`GitHub error: ${
					githubError instanceof Error
						? githubError.message
						: String(githubError)
				}; ClawHub error: ${
					clawhubError instanceof Error
						? clawhubError.message
						: String(clawhubError)
				}`,
			);
		}
	}

	/**
	 * Parse SKILL.md content to extract YAML frontmatter
	 */
	private parseSkillMetadata(content: string): SkillMetadata {
		const parsed = parseSkillFrontmatter(content);
		return {
			name: parsed.name,
			description: parsed.description,
			...(parsed.license ? { license: parsed.license } : {}),
			...(parsed.compatibility
				? { compatibility: parsed.compatibility }
				: {}),
			...(parsed.allowedTools.length > 0
				? { allowedTools: parsed.allowedTools }
				: {}),
			...(parsed.metadata ? { metadata: parsed.metadata } : {}),
		};
	}

	/**
	 * Download all files for a skill
	 */
	async downloadSkill(
		skillName: string,
	): Promise<Map<string, string | Buffer>> {
		try {
			if (this.provider === "clawhub") {
				return await this.downloadSkillFromClawhub(skillName);
			}
			if (this.provider === "github") {
				const repository = await this.resolveGitHubRepositoryForSkill(skillName);
				const files = new Map<string, string | Buffer>();
				await this.downloadDirectory(
					`skills/${skillName}`,
					files,
					skillName,
					repository,
				);
				return files;
			}
			return await this.downloadHybridSkill(skillName);
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to download skill ${skillName}: ${error.message}`,
				);
			}
			throw error;
		}
	}

	private async downloadSkillFromClawhub(
		skillName: string,
	): Promise<Map<string, string | Buffer>> {
		try {
			const detail = await this.fetchJson<ClawHubSkillDetailResponse>(
				`${this.clawhubBaseUrl}/api/v1/skills/${encodeURIComponent(skillName)}`,
				{
					headers: {
						Accept: "application/json",
						"User-Agent": "wingman-cli",
					},
				},
			);
			const slug = detail.skill?.slug || skillName;
			const version = detail.latestVersion?.version;
			if (!version) {
				throw new Error("No latest version available");
			}

			const filesResponse = await this.fetchJson<ClawHubVersionFilesResponse>(
				`${this.clawhubBaseUrl}/api/v1/skills/${encodeURIComponent(slug)}/versions/${encodeURIComponent(version)}`,
				{
					headers: {
						Accept: "application/json",
						"User-Agent": "wingman-cli",
					},
				},
			);
			const files = filesResponse.version?.files || [];
			const output = new Map<string, string | Buffer>();
			for (const file of files) {
				const fileUrl = new URL(
					`${this.clawhubBaseUrl}/api/v1/skills/${encodeURIComponent(slug)}/file`,
				);
				fileUrl.searchParams.set("path", file.path);
				fileUrl.searchParams.set("version", version);
				const content = await this.fetchBinary(fileUrl.toString(), {
					headers: {
						Accept: "text/plain, application/octet-stream",
						"User-Agent": "wingman-cli",
					},
				});
				output.set(file.path, content);
			}
			return output;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to download skill ${skillName}: ${error.message}`,
				);
			}
			throw error;
		}
	}

	private async downloadHybridSkill(
		skillName: string,
	): Promise<Map<string, string | Buffer>> {
		let githubError: unknown;
		try {
			const repository = await this.resolveGitHubRepositoryForSkill(skillName);
			const files = new Map<string, string | Buffer>();
			await this.downloadDirectory(
				`skills/${skillName}`,
				files,
				skillName,
				repository,
			);
			return files;
		} catch (error) {
			githubError = error;
			logger.debug(
				`Falling back to ClawHub download for '${skillName}' after GitHub error: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}

		try {
			return await this.downloadSkillFromClawhub(skillName);
		} catch (clawhubError) {
			throw new Error(
				`GitHub error: ${
					githubError instanceof Error
						? githubError.message
						: String(githubError)
				}; ClawHub error: ${
					clawhubError instanceof Error
						? clawhubError.message
						: String(clawhubError)
				}`,
			);
		}
	}

	/**
	 * Recursively download all files in a directory
	 */
	private async downloadDirectory(
		path: string,
		files: Map<string, string | Buffer>,
		skillName: string,
		repository: SkillGitHubRepository,
	): Promise<void> {
		const contents = await this.fetchGitHub<GitHubContentItem[]>(
			`/repos/${repository.owner}/${repository.name}/contents/${path}`,
		);

		for (const item of contents) {
			if (item.type === "file") {
				if (!item.content) {
					// If content is not included, fetch the file directly
					const fileData = await this.fetchGitHub<GitHubContentItem>(
						item.url.replace(this.githubBaseUrl, ""),
					);
					if (fileData.content && fileData.encoding === "base64") {
						const content = Buffer.from(
							fileData.content,
							"base64",
						);
						// Store relative path from skill root
						const relativePath = item.path.replace(
							`skills/${skillName}/`,
							"",
						);
						files.set(relativePath, content);
					}
				} else {
					// Content is included in response
					const content = Buffer.from(item.content, "base64");
					const relativePath = item.path.replace(
						`skills/${skillName}/`,
						"",
					);
					files.set(relativePath, content);
				}
			} else if (item.type === "dir") {
				// Recursively download subdirectories
				await this.downloadDirectory(item.path, files, skillName, repository);
			}
		}
	}

	private async listSkillsFromClawhub(): Promise<SkillInfo[]> {
		const allSkills: SkillInfo[] = [];
		let cursor: string | null = null;
		do {
			const url = new URL(`${this.clawhubBaseUrl}/api/v1/skills`);
			url.searchParams.set("sort", "downloads");
			url.searchParams.set("limit", "100");
			if (cursor) {
				url.searchParams.set("cursor", cursor);
			}
			const response = await this.fetchJson<
				ClawHubSkillListResponse & { nextCursor?: string | null }
			>(url.toString(), {
				headers: {
					Accept: "application/json",
					"User-Agent": "wingman-cli",
				},
			});
			for (const item of response.items || []) {
				allSkills.push({
					name: item.slug,
					description:
						item.summary?.trim() || item.displayName?.trim() || "No description",
					path: item.slug,
					metadata: {
						name: item.slug,
						description:
							item.summary?.trim() || item.displayName?.trim() || "No description",
					},
				});
			}
			cursor = response.nextCursor || null;
		} while (cursor);
		return allSkills;
	}

	private async listSkillsFromHybrid(): Promise<SkillInfo[]> {
		let clawhubSkills: SkillInfo[] = [];
		let githubSkills: SkillInfo[] = [];
		let clawhubError: unknown;
		let githubError: unknown;

		try {
			clawhubSkills = await this.listSkillsFromClawhub();
		} catch (error) {
			clawhubError = error;
			logger.warn(
				`Failed to list ClawHub skills in hybrid mode: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}

		try {
			githubSkills = await this.listSkillsFromGitHub();
		} catch (error) {
			githubError = error;
			logger.warn(
				`Failed to list GitHub skills in hybrid mode: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}

		if (clawhubSkills.length === 0 && githubSkills.length === 0) {
			throw new Error(
				`No skill sources available. ClawHub error: ${
					clawhubError instanceof Error
						? clawhubError.message
						: "none"
				}; GitHub error: ${
					githubError instanceof Error ? githubError.message : "none"
				}`,
			);
		}

		const mergedSkills = new Map<string, SkillInfo>();
		for (const skill of clawhubSkills) {
			mergedSkills.set(skill.name, skill);
		}
		// GitHub entries override ClawHub entries on name conflicts.
		for (const skill of githubSkills) {
			if (mergedSkills.has(skill.name)) {
				mergedSkills.delete(skill.name);
			}
			mergedSkills.set(skill.name, skill);
		}
		return [...mergedSkills.values()];
	}

	private async listSkillsFromGitHub(): Promise<SkillInfo[]> {
		const mergedSkills = new Map<string, SkillInfo>();
		for (const repository of this.getGitHubRepositories()) {
			const contents = await this.fetchGitHub<GitHubContentItem[]>(
				`/repos/${repository.owner}/${repository.name}/contents/skills`,
			);

			for (const item of contents) {
				if (item.type !== "dir") {
					continue;
				}
				try {
					const metadata = await this.getGitHubSkillMetadata(
						item.name,
						repository,
					);
					// Later repositories override earlier repositories on conflicts.
					if (mergedSkills.has(item.name)) {
						mergedSkills.delete(item.name);
					}
					mergedSkills.set(item.name, {
						name: item.name,
						description: metadata.description || "No description",
						path: item.path,
						metadata,
					});
				} catch (error) {
					// Skip skills that can't be read
					logger.warn(
						`Could not read skill ${item.name} from ${repository.owner}/${repository.name}`,
						error instanceof Error ? error.message : String(error),
					);
				}
			}
		}
		return [...mergedSkills.values()];
	}

	private getGitHubRepositories(): SkillGitHubRepository[] {
		if (this.repositories.length > 0) {
			return this.repositories;
		}
		throw new Error(
			"No GitHub skill repositories configured. Set skills.repositories or the legacy skills.repositoryOwner + skills.repositoryName fields.",
		);
	}
}
