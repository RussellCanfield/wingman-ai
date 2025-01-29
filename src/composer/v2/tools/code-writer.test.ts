import { expect } from "vitest";
import { CodeResponse } from "./code-writer";

describe("Code Writer", () => {
    it("parses output into files", () => {
        const fileContent = `Path: /src/test.tsx
Language: typescript
Description: Does stuff
Dependencies: ['test123']
Code: {
        console.log()
}`
        const pathMatch = fileContent.match(/Path: (.*?)(?:\n|$)/);
        const langMatch = fileContent.match(/Language: (.*?)(?:\n|$)/);
        const descMatch = fileContent.match(/Description: (.*?)(?:\n|$)/);
        const codeMatch = fileContent.match(/Code:\s*(?:\n|\s+)?([\s\S]*$)/);
        const depsMatch = fileContent.match(/Dependencies: (.*?)(?:\n|$)/);

        const fileUpdate: CodeResponse['file'] = {
            path: pathMatch?.[1].trim() || '',
            markdownLanguage: langMatch?.[1].trim() || '',
            description: descMatch?.[1].trim() || '',
            code: codeMatch?.[1].trim() || '',
            dependencies: depsMatch?.[1]?.split(',').map(d => d.trim()) || [],
        };

        expect(fileUpdate.path).toBe('/src/test.tsx');
        expect(fileUpdate.markdownLanguage).toBe('typescript');
        expect(fileUpdate.description).toBe('Does stuff');
        expect(fileUpdate.code).toBe('{\n        console.log()\n}');
        expect(fileUpdate.dependencies).toEqual(["['test123']"]);
    });
})