import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn, type ChildProcess } from "node:child_process";

const commandExecuteSchema = z.object({
    command: z.string().describe("The command to execute in the terminal")
});

type CommandExecuteInput = z.infer<typeof commandExecuteSchema>;

const BLOCKED_COMMANDS = [
    'rm', 'remove', 'del', 'delete',
    'rmdir', 'rd',
    'mv', 'move',
    'format',
    '>', '>>',
    'chmod', 'chown',
    ':>',
    'sudo', 'su'
];

export const createCommandExecuteTool = (workspace: string) => {
    return new DynamicStructuredTool<typeof commandExecuteSchema>({
        name: "command_execute",
        description: "Executes a command in a terminal and reports the output",
        schema: commandExecuteSchema,
        async func(input: CommandExecuteInput) {
            return new Promise((resolve, reject) => {
                try {
                    const commandLower = input.command.toLowerCase();

                    if (BLOCKED_COMMANDS.some(cmd =>
                        commandLower.includes(cmd) ||
                        commandLower.includes(`/${cmd}`) ||
                        commandLower.includes(`\\${cmd}`))) {
                        resolve("Command rejected: Contains potentially destructive operations");
                        return;
                    }

                    if (commandLower.includes('.sh') ||
                        commandLower.includes('.bat') ||
                        commandLower.includes('.cmd')) {
                        resolve("Command rejected: Script execution not allowed");
                        return;
                    }

                    let output = '';
                    let hasExited = false;

                    const terminalProcess: ChildProcess = spawn(input.command, [], {
                        cwd: workspace,
                        shell: true,
                        env: {
                            ...process.env,
                            FORCE_COLOR: "0",
                            NO_COLOR: "1"
                        },
                        windowsHide: true
                    });

                    const timeout = setTimeout(() => {
                        if (!hasExited) {
                            try {
                                terminalProcess.kill();
                            } catch (e) {
                                // Ignore kill errors
                            }
                            resolve('Command timed out after 60 seconds');
                        }
                    }, 60000);

                    terminalProcess.stdout?.on('data', (data) => {
                        output += data.toString();
                    });

                    terminalProcess.stderr?.on('data', (data) => {
                        output += data.toString();
                    });

                    terminalProcess.on('error', (err) => {
                        if (!hasExited) {
                            hasExited = true;
                            clearTimeout(timeout);
                            resolve(`Command failed: ${err.message}\nOutput:\n${output}`);
                        }
                    });

                    terminalProcess.on('exit', (code) => {
                        if (!hasExited) {
                            hasExited = true;
                            clearTimeout(timeout);
                            if (code === 0) {
                                resolve(output || 'Command completed successfully');
                            } else {
                                resolve(`Command failed with exit code: ${code}\nOutput:\n${output}`);
                            }
                        }
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    resolve(`Failed to execute command: ${errorMessage}`);
                }
            });
        }
    });
};