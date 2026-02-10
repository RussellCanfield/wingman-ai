import { describe, expect, it } from "vitest";
import { createCommandExecuteTool } from "../tools/command_execute";

describe("command_execute tool", () => {
	it("rejects blocked commands", async () => {
		const tool = createCommandExecuteTool(process.cwd(), undefined, ["rm"]);
		const result = await tool.invoke({ command: "rm -rf ./tmp" });
		expect(String(result)).toContain("rejected");
	});

	it("truncates oversized output to avoid oversized tool payloads", async () => {
		const tool = createCommandExecuteTool(
			process.cwd(),
			undefined,
			[],
			true,
			30_000,
			120,
		);
		const result = await tool.invoke({
			command: "node -e \"process.stdout.write('x'.repeat(400))\"",
		});
		const output = String(result);

		expect(output).toContain("completed successfully");
		expect(output).toContain("output truncated");
		expect(output.length).toBeLessThan(800);
	});
});
