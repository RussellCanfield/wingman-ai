import type {
	GitHubContentItem,
	SkillInfo,
	SkillMetadata,
	SkillRepositoryOptions,
} from "../types/skill.js";
import { createLogger } from "@/logger.js";

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
	private readonly owner: string;
	private readonly repo: string;
	private readonly token?: string;
	private readonly provider: "github" | "clawhub";
	private readonly clawhubBaseUrl: string;

	constructor(options: SkillRepositoryOptions = {}) {
		this.provider = options.provider || "github";
		this.owner = options.repositoryOwner || "anthropics";
		this.repo = options.repositoryName || "skills";
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
			return await this.listSkillsFromGitHub();
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
		if (this.provider === "clawhub") {
			return await this.getClawhubSkillMetadata(skillName);
		}

		try {
			const skillMdPath = `/repos/${this.owner}/${this.repo}/contents/skills/${skillName}/SKILL.md`;
			const skillMd = await this.fetchGitHub<GitHubContentItem>(skillMdPath);

			if (skillMd.type !== "file" || !skillMd.content) {
				throw new Error("SKILL.md not found or invalid");
			}

			// Decode base64 content
			const content = Buffer.from(skillMd.content, "base64").toString(
				"utf-8",
			);

			// Parse YAML frontmatter
			const metadata = this.parseSkillMetadata(content);

			return metadata;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to fetch skill metadata for ${skillName}: ${error.message}`,
				);
			}
			throw error;
		}
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

	/**
	 * Parse SKILL.md content to extract YAML frontmatter
	 */
	private parseSkillMetadata(content: string): SkillMetadata {
		const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
		const match = content.match(frontmatterRegex);

		if (!match) {
			throw new Error(
				"Invalid SKILL.md format: missing YAML frontmatter",
			);
		}

		const frontmatter = match[1];
		const metadata: SkillMetadata = {
			name: "",
			description: "",
		};

		// Simple YAML parser for key-value pairs
		const lines = frontmatter.split("\n");
		for (const line of lines) {
			const colonIndex = line.indexOf(":");
			if (colonIndex === -1) continue;

			const key = line.substring(0, colonIndex).trim();
			const value = line.substring(colonIndex + 1).trim();

			switch (key) {
				case "name":
					metadata.name = value;
					break;
				case "description":
					metadata.description = value;
					break;
				case "license":
					metadata.license = value;
					break;
				case "compatibility":
					metadata.compatibility = value;
					break;
				case "allowed-tools":
					metadata.allowedTools = value;
					break;
			}
		}

		// Validate required fields
		if (!metadata.name) {
			throw new Error(
				"Invalid SKILL.md: missing required field 'name'",
			);
		}
		if (!metadata.description) {
			throw new Error(
				"Invalid SKILL.md: missing required field 'description'",
			);
		}

		// Validate name format
		const nameRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
		if (!nameRegex.test(metadata.name)) {
			throw new Error(
				`Invalid skill name '${metadata.name}': must be lowercase alphanumeric with hyphens only`,
			);
		}

		return metadata;
	}

	/**
	 * Download all files for a skill
	 */
	async downloadSkill(
		skillName: string,
	): Promise<Map<string, string | Buffer>> {
		if (this.provider === "clawhub") {
			return await this.downloadSkillFromClawhub(skillName);
		}
		try {
			const files = new Map<string, string | Buffer>();
			await this.downloadDirectory(
				`skills/${skillName}`,
				files,
				skillName,
			);
			return files;
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

	/**
	 * Recursively download all files in a directory
	 */
	private async downloadDirectory(
		path: string,
		files: Map<string, string | Buffer>,
		skillName: string,
	): Promise<void> {
		const contents = await this.fetchGitHub<GitHubContentItem[]>(
			`/repos/${this.owner}/${this.repo}/contents/${path}`,
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
				await this.downloadDirectory(item.path, files, skillName);
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

	private async listSkillsFromGitHub(): Promise<SkillInfo[]> {
		const contents = await this.fetchGitHub<GitHubContentItem[]>(
			`/repos/${this.owner}/${this.repo}/contents/skills`,
		);

		const skills: SkillInfo[] = [];

		for (const item of contents) {
			if (item.type === "dir") {
				try {
					const metadata = await this.getSkillMetadata(item.name);
					skills.push({
						name: item.name,
						description: metadata.description || "No description",
						path: item.path,
						metadata,
					});
				} catch (error) {
					// Skip skills that can't be read
					logger.warn(
						`Could not read skill ${item.name}`,
						error instanceof Error ? error.message : String(error),
					);
				}
			}
		}

		return skills;
	}
}
