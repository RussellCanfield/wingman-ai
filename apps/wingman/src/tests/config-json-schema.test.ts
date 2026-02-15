import { describe, expect, it } from "vitest";
import {
	buildWingmanConfigJsonSchema,
	WINGMAN_CONFIG_JSON_SCHEMA_ID,
} from "../cli/config/jsonSchema";

describe("wingman config json schema", () => {
	it("includes metadata and top-level sections", () => {
		const schema = buildWingmanConfigJsonSchema() as Record<string, any>;

		expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
		expect(schema.$id).toBe(WINGMAN_CONFIG_JSON_SCHEMA_ID);
		expect(schema.title).toBe("Wingman Config");
		expect(schema.type).toBe("object");
		expect(schema.properties).toBeDefined();
		expect(schema.properties.gateway).toBeDefined();
		expect(schema.properties.skills).toBeDefined();
	});

	it("exposes resilient default scanner args", () => {
		const schema = buildWingmanConfigJsonSchema() as Record<string, any>;
		const scannerArgsDefault =
			schema.properties.skills.properties.security.properties.scannerArgs.default;

		expect(scannerArgsDefault).toContain("mcp-scan>=0.4,<0.5");
	});
});
