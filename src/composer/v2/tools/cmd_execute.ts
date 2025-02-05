import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn, type ChildProcess } from "node:child_process";

const commandExecuteSchema = z.object({
    command: z.string().describe("The command to execute in the terminal")
});

type CommandExecuteInput = z.infer<typeof commandExecuteSchema>;

// Dangerous commands that could modify or delete files
const BLOCKED_COMMANDS = [
    'rm', 'remove', 'del', 'delete',
    'rmdir', 'rd',
    'mv', 'move',
    'format',
    '>', '>>', // Redirections
    'chmod', 'chown', // Permission changes
    ':>', // File truncation
    'sudo', 'su' // Privilege escalation
];

export const createCommandExecuteTool = (workspace: string) => {
    return new DynamicStructuredTool<typeof commandExecuteSchema>({
        name: "command_execute",
        description: "Executes a command in a terminal and reports the output",
        schema: commandExecuteSchema,
        async func(input: CommandExecuteInput) {
            return new Promise((resolve, reject) => {
                const commandLower = input.command.toLowerCase();

                // Check for dangerous commands
                if (BLOCKED_COMMANDS.some(cmd =>
                    commandLower.includes(cmd) ||
                    commandLower.includes(`/${cmd}`) ||
                    commandLower.includes(`\\${cmd}`))) {
                    resolve("Command rejected: Contains potentially destructive operations");
                    return;
                }

                // Prevent shell script execution
                if (commandLower.includes('.sh') ||
                    commandLower.includes('.bat') ||
                    commandLower.includes('.cmd')) {
                    resolve("Command rejected: Script execution not allowed");
                    return;
                }

                const args = input.command.split(' ').slice(1);
                const cmd = input.command.split(' ')[0];
                let output = '';

                const process: ChildProcess = spawn(cmd, args, {
                    cwd: workspace,
                    shell: true,
                    // Prevent access to parent environment variables
                    env: {
                        //@ts-expect-error
                        PATH: process.env.PATH,
                    }
                });

                process.stdout?.on('data', (data) => {
                    output += data.toString();
                });

                process.stderr?.on('data', (data) => {
                    output += data.toString();
                });

                process.on('close', (code) => {
                    if (code === 0) {
                        resolve(output);
                    } else {
                        resolve(`Command failed with exit code: ${code}\nOutput:\n${output}`);
                    }
                });

                // Set timeout to prevent long-running commands
                const timeout = setTimeout(() => {
                    process.kill();
                    resolve('Command timed out after 5 seconds');
                }, 60000);

                process.on('error', (err) => {
                    clearTimeout(timeout);
                    resolve(`Command failed with exit code: ${1}\nOutput:\n${output}`);
                });

                process.on('exit', () => {
                    clearTimeout(timeout);
                });
            });
        }
    });
};