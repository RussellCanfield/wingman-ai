import * as z from "zod";
import { WingmanConfigSchema } from "./schema.js";

export const WINGMAN_CONFIG_JSON_SCHEMA_ID =
	"https://getwingmanai.com/schemas/wingman.config.schema.json";

export function buildWingmanConfigJsonSchema(): Record<string, unknown> {
	const schema = z.toJSONSchema(WingmanConfigSchema, {
		target: "draft-2020-12",
		unrepresentable: "any",
	});
	const { $schema: _ignored, ...schemaWithoutMeta } =
		schema as Record<string, unknown>;

	return {
		$schema: "https://json-schema.org/draft/2020-12/schema",
		$id: WINGMAN_CONFIG_JSON_SCHEMA_ID,
		title: "Wingman Config",
		description: "Schema for .wingman/wingman.config.json",
		...schemaWithoutMeta,
	};
}
