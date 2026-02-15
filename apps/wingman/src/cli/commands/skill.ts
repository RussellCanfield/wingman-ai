import type { SkillCommandArgs } from "../types/skill.js";
import { SkillRepository } from "../services/skillRepository.js";
import { SkillService } from "../services/skillService.js";
import { OutputManager } from "../core/outputManager.js";
import { createBridgedLogger } from "../core/loggerBridge.js";
import { WingmanConfigLoader } from "../config/loader.js";
import { getLogFilePath } from "@/logger.js";

export interface SkillCommandOptions {
	workspace?: string;
	configDir?: string;
}

/**
 * Execute the skill command
 * This is the handler for: wingman skill <subcommand> [args]
 */
export async function executeSkillCommand(
	args: SkillCommandArgs,
	options: SkillCommandOptions = {},
): Promise<void> {
	// Create output manager
	const outputManager = new OutputManager(args.outputMode);

	// Create bridged logger
	const logger = createBridgedLogger(outputManager, args.verbosity);

	// Get workspace (default to current directory)
	const workspace = options.workspace || process.cwd();
	const configDir = options.configDir || ".wingman";

	// Load configuration
	const configLoader = new WingmanConfigLoader(configDir, workspace);
	const config = configLoader.loadConfig();

	try {
		// Create repository and service
		const repository = new SkillRepository({
			provider: config.skills?.provider,
			repositoryOwner: config.skills?.repositoryOwner,
			repositoryName: config.skills?.repositoryName,
			githubToken: config.skills?.githubToken,
			clawhubBaseUrl: config.skills?.clawhubBaseUrl,
		});

		const service = new SkillService(repository, outputManager, logger, {
			workspace,
			skillsDirectory: config.skills?.skillsDirectory,
			outputMode: args.outputMode,
			security: config.skills?.security,
		});

		// Route to subcommand
		const subcommand = args.subcommand;
		const subcommandArgs = args.args;

		switch (subcommand) {
			case "browse":
				await service.browseSkills();
				break;

			case "install": {
				if (subcommandArgs.length === 0) {
					throw new Error(
						"Skill name required. Usage: wingman skill install <skill-name>",
					);
				}
				const skillName = subcommandArgs[0];
				await service.installSkill(skillName);
				break;
			}

			case "list":
				await service.listInstalledSkills();
				break;

			case "remove": {
				if (subcommandArgs.length === 0) {
					throw new Error(
						"Skill name required. Usage: wingman skill remove <skill-name>",
					);
				}
				const skillName = subcommandArgs[0];
				await service.removeSkill(skillName);
				break;
			}

			case "":
			case "help":
			case "--help":
			case "-h":
				showSkillHelp(outputManager);
				break;

			default:
				throw new Error(
					`Unknown subcommand: ${subcommand}. Run 'wingman skill help' for usage.`,
				);
		}
	} catch (error) {
		const errorMsg =
			error instanceof Error ? error.message : String(error);
		const logFile = getLogFilePath();
		logger.error("Skill command failed", { error: errorMsg });

		if (outputManager.getMode() === "interactive") {
			console.error(`\nError: ${errorMsg}`);
			console.error(`Logs: ${logFile}`);
			process.exit(1);
		} else {
			outputManager.emitAgentError(error as Error);
			process.exit(1);
		}
	}
}

/**
 * Display help for skill commands
 */
function showSkillHelp(outputManager: OutputManager): void {
	if (outputManager.getMode() === "interactive") {
		console.log(`
Wingman Skill Manager - Install skills from configured registries

Usage:
  wingman skill browse              Browse available skills
  wingman skill install <name>      Install a skill
  wingman skill list                List installed skills
  wingman skill remove <name>       Remove an installed skill
  wingman skill help                Show this help message

Examples:
  wingman skill browse
  wingman skill install pdf
  wingman skill list
  wingman skill remove pdf

Environment Variables:
  GITHUB_TOKEN    Optional GitHub token for higher API rate limits
                  (5000/hour vs 60/hour without token)

Configuration:
  Skills can be configured in .wingman/wingman.config.json:
  {
    "skills": {
      "provider": "github",
      "repositoryOwner": "anthropics",
      "repositoryName": "skills",
      "githubToken": "optional-token",
      "clawhubBaseUrl": "https://clawhub.ai",
      "skillsDirectory": "skills",
      "security": {
        "scanOnInstall": true
      }
    }
  }
`);
	} else {
		outputManager.emitEvent({
			type: "log",
			level: "info",
			message: "Skill help requested",
			timestamp: new Date().toISOString(),
		});
	}
}
