#!/usr/bin/env node

import { Command } from "commander";
import { WingmanCLI } from "./cli/WingmanCLI.js";
import { logStartup, logShutdown, getLogInfo, cliLogger } from "./utils/logger.js";

const program = new Command();

program
	.version("1.0.0")
	.description("An AI coding assistant for your terminal.")
	.option("-l, --log-level <level>", "Set log level (trace, debug, info, warn, error, fatal)", "info")
	.argument("[prompt...]", "The prompt to send to the agent")
	.action(async (promptParts: string[], options) => {
		// Set log level from CLI option
		if (options.logLevel) {
			process.env.WINGMAN_LOG_LEVEL = options.logLevel;
		}

		const startTime = Date.now();
		const initialPrompt = promptParts && promptParts.length > 0 ? promptParts.join(" ") : undefined;
		
		// Log startup information
		logStartup({
			initialPrompt,
			logLevel: options.logLevel,
			nodeVersion: process.version,
			platform: process.platform,
			arch: process.arch,
			pid: process.pid,
			cwd: process.cwd(),
		});

		// Set up graceful shutdown logging
		const handleShutdown = (signal: string) => {
			const duration = Date.now() - startTime;
			logShutdown({ 
				signal, 
				duration,
				reason: 'signal_received' 
			});
			process.exit(0);
		};

		process.on('SIGINT', () => handleShutdown('SIGINT'));
		process.on('SIGTERM', () => handleShutdown('SIGTERM'));

		try {
			cliLogger.debug({ event: 'cli_start' }, 'Starting Wingman CLI');
			
			const cli = new WingmanCLI();
			await cli.run(initialPrompt);
			
			const duration = Date.now() - startTime;
			logShutdown({ 
				duration,
				reason: 'normal_exit' 
			});
		} catch (error) {
			const duration = Date.now() - startTime;
			cliLogger.error({ 
				event: 'startup_error',
				error: {
					name: error instanceof Error ? error.name : 'Unknown',
					message: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				},
				duration 
			}, 'Failed to start Wingman CLI');
			
			logShutdown({ 
				duration,
				reason: 'error_exit',
				error: error instanceof Error ? error.message : String(error)
			});
			
			process.exit(1);
		}
	});

// Add debug command to show log information
program
	.command("debug")
	.description("Show debug information and log file location")
	.action(() => {
		const logInfo = getLogInfo();
		console.log('\n🐛 Wingman CLI Debug Information');
		console.log('================================');
		console.log(`Log Level: ${logInfo.level}`);
		console.log(`Log File: ${logInfo.file}`);
		console.log(`Logging Enabled: ${logInfo.enabled ? '✅ Yes' : '❌ No'}`);
		console.log('\nTo change log level:');
		console.log('  wingman --log-level debug [prompt]');
		console.log('  WINGMAN_LOG_LEVEL=debug wingman [prompt]');
		console.log('\nAvailable log levels:');
		console.log('  trace - Most verbose, includes all debug info');
		console.log('  debug - Detailed debugging information');
		console.log('  info  - General information (default)');
		console.log('  warn  - Warning messages only');
		console.log('  error - Error messages only');
		console.log('  fatal - Fatal errors only');
		console.log('\nTo view logs:');
		console.log(`  tail -f ${logInfo.file}`);
		console.log('');
	});

program.parse(process.argv);