import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn } from "child_process";

const commandExecuteSchema = z.object({
    command: z.string().describe("The command to execute in the terminal")
});

type CommandExecuteInput = z.infer<typeof commandExecuteSchema>;

export const createCommandExecuteTool = (workspace: string) => {
    return new DynamicStructuredTool<typeof commandExecuteSchema>({
        name: "command_execute",
        description: "Executes a command in a terminal and reports the output",
        schema: commandExecuteSchema,
        async func(input: CommandExecuteInput) {
            return new Promise((resolve, reject) => {
                const [cmd, ...args] = input.command.split(' ');
                let output = '';

                const process = spawn(cmd, args, {
                    cwd: workspace,
                    shell: true
                });

                process.stdout.on('data', (data) => {
                    output += data.toString();
                });

                process.stderr.on('data', (data) => {
                    output += data.toString();
                });

                process.on('close', (code) => {
                    if (code === 0) {
                        resolve(output);
                    } else {
                        reject(new Error(`Command failed with exit code ${code}\n${output}`));
                    }
                });

                process.on('error', (err) => {
                    reject(new Error(`Failed to start command: ${err.message}`));
                });
            });
        }
    });
};