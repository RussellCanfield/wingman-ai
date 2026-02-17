import * as yaml from "js-yaml";

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---/;
const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const SUPPORTED_SKILL_METADATA_NAMESPACES = ["wingman", "openclaw"] as const;

export type SupportedSkillMetadataNamespace =
	(typeof SUPPORTED_SKILL_METADATA_NAMESPACES)[number];

export interface SkillInstallRecipe {
	id: string;
	kind: string;
	label?: string;
	formula?: string;
	bins: string[];
}

export interface SkillRuntimeMetadata {
	namespace: SupportedSkillMetadataNamespace;
	emoji?: string;
	requires: {
		bins: string[];
	};
	install: SkillInstallRecipe[];
}

export interface ParsedSkillFrontmatter {
	name: string;
	description: string;
	license?: string;
	compatibility?: string;
	allowedTools: string[];
	metadata?: Record<string, unknown>;
	runtimeMetadata: SkillRuntimeMetadata | null;
}

const toRecord = (value: unknown): Record<string, unknown> | null => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string | null => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

const toStringArray = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		const normalized = value
			.map((entry) => (typeof entry === "string" ? entry.trim() : ""))
			.filter(Boolean);
		return Array.from(new Set(normalized));
	}
	if (typeof value === "string") {
		const normalized = value
			.split(/[\s,]+/)
			.map((entry) => entry.trim())
			.filter(Boolean);
		return Array.from(new Set(normalized));
	}
	return [];
};

const parseInstallRecipe = (value: unknown): SkillInstallRecipe | null => {
	const recipe = toRecord(value);
	if (!recipe) return null;

	const kind = toTrimmedString(recipe.kind);
	if (!kind) return null;

	const id = toTrimmedString(recipe.id) || kind;
	const label = toTrimmedString(recipe.label);
	const formula = toTrimmedString(recipe.formula);

	return {
		id,
		kind,
		...(label ? { label } : {}),
		...(formula ? { formula } : {}),
		bins: toStringArray(recipe.bins),
	};
};

export const parseSkillRuntimeMetadata = (
	value: unknown,
): SkillRuntimeMetadata | null => {
	const metadata = toRecord(value);
	if (!metadata) return null;

	for (const namespace of SUPPORTED_SKILL_METADATA_NAMESPACES) {
		const namespaceConfig = toRecord(metadata[namespace]);
		if (!namespaceConfig) continue;

		const requires = toRecord(namespaceConfig.requires);
		const installRaw = Array.isArray(namespaceConfig.install)
			? namespaceConfig.install
			: [];
		const emoji = toTrimmedString(namespaceConfig.emoji);

		return {
			namespace,
			...(emoji ? { emoji } : {}),
			requires: {
				bins: toStringArray(requires?.bins),
			},
			install: installRaw
				.map(parseInstallRecipe)
				.filter((recipe): recipe is SkillInstallRecipe => Boolean(recipe)),
		};
	}

	return null;
};

const parseAllowedTools = (frontmatter: Record<string, unknown>): string[] => {
	if (frontmatter["allowed-tools"] !== undefined) {
		return toStringArray(frontmatter["allowed-tools"]);
	}
	if (frontmatter.allowedTools !== undefined) {
		return toStringArray(frontmatter.allowedTools);
	}
	return [];
};

export const parseSkillFrontmatter = (content: string): ParsedSkillFrontmatter => {
	const match = content.match(FRONTMATTER_REGEX);
	if (!match) {
		throw new Error("Invalid SKILL.md format: missing YAML frontmatter");
	}

	const frontmatterRaw = match[1];
	const parsed = yaml.load(frontmatterRaw);
	const frontmatter = toRecord(parsed);
	if (!frontmatter) {
		throw new Error("Invalid SKILL.md: frontmatter must be a YAML object");
	}

	const name = toTrimmedString(frontmatter.name);
	if (!name) {
		throw new Error("Invalid SKILL.md: missing required field 'name'");
	}
	if (!SKILL_NAME_REGEX.test(name)) {
		throw new Error(
			`Invalid skill name '${name}': must be lowercase alphanumeric with hyphens only`,
		);
	}

	const description = toTrimmedString(frontmatter.description);
	if (!description) {
		throw new Error("Invalid SKILL.md: missing required field 'description'");
	}

	const metadata = toRecord(frontmatter.metadata) || undefined;
	const license = toTrimmedString(frontmatter.license);
	const compatibility = toTrimmedString(frontmatter.compatibility);

	return {
		name,
		description,
		...(license ? { license } : {}),
		...(compatibility ? { compatibility } : {}),
		allowedTools: parseAllowedTools(frontmatter),
		metadata,
		runtimeMetadata: parseSkillRuntimeMetadata(metadata),
	};
};
