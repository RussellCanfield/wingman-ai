import { expect, describe, beforeEach, it } from "vitest";

describe("Dependency Parser", () => {
    let fileContentBuffer: string;

    beforeEach(() => {
        fileContentBuffer = '';
    });

    const parseDependencies = (content: string): Set<string> => {
        const dependencies: Set<string> = new Set();

        // First, get the Dependencies section
        const lines = content.split('\n');
        let inDependenciesSection = false;

        for (const line of lines) {
            if (line.trim() === '### Dependencies') {
                inDependenciesSection = true;
                continue;
            }

            if (inDependenciesSection && line.trim().startsWith('###')) {
                break;
            }

            if (inDependenciesSection && line.trim().startsWith('-')) {
                // Extract package name, handling both backtick and non-backtick cases
                const cleaned = line.trim().replace(/^-\s*/, '');
                const packageMatch = cleaned.match(/^`?(@?[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9-]+)?)`?/);

                if (packageMatch && packageMatch[1]) {
                    dependencies.add(packageMatch[1]);
                }
            }
        }

        return dependencies;
    };

    it("parses dependencies with backticks and descriptions", () => {
        fileContentBuffer = `### Dependencies
- \`@tanstack/react-query\`
- \`react-hook-form\`
- \`zod\`
- \`axios\``;

        const dependencies = parseDependencies(fileContentBuffer);

        expect(dependencies.size).toBe(4);
        expect(dependencies.has("@tanstack/react-query")).toBe(true);
        expect(dependencies.has("react-hook-form")).toBe(true);
        expect(dependencies.has("zod")).toBe(true);
        expect(dependencies.has("axios")).toBe(true);
    });

    it("parses dependencies without backticks", () => {
        fileContentBuffer = `### Dependencies
- @tanstack/react-query
- react-hook-form
- zod
- axios`;

        const dependencies = parseDependencies(fileContentBuffer);

        expect(dependencies.size).toBe(4);
        expect(dependencies.has("@tanstack/react-query")).toBe(true);
        expect(dependencies.has("react-hook-form")).toBe(true);
        expect(dependencies.has("zod")).toBe(true);
        expect(dependencies.has("axios")).toBe(true);
    });
});