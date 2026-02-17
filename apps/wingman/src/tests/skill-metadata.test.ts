import { describe, expect, it } from "vitest";
import { parseSkillFrontmatter } from "@/skills/metadata.js";

describe("parseSkillFrontmatter", () => {
	it("parses wingman metadata with requires and install recipes", () => {
		const content = `---
name: gog
description: Google tooling
metadata:
  wingman:
    emoji: "🎮"
    requires:
      bins: ["gog"]
    install:
      - id: brew
        kind: brew
        formula: steipete/tap/gogcli
        bins: ["gog"]
        label: Install gog (brew)
---

# gog
`;

		const parsed = parseSkillFrontmatter(content);
		expect(parsed.name).toBe("gog");
		expect(parsed.description).toBe("Google tooling");
		expect(parsed.runtimeMetadata?.namespace).toBe("wingman");
		expect(parsed.runtimeMetadata?.requires.bins).toEqual(["gog"]);
		expect(parsed.runtimeMetadata?.install).toEqual([
			{
				id: "brew",
				kind: "brew",
				formula: "steipete/tap/gogcli",
				bins: ["gog"],
				label: "Install gog (brew)",
			},
		]);
	});

	it("prefers wingman over openclaw when both namespaces are present", () => {
		const content = `---
name: dual
description: Dual namespace
metadata:
  openclaw:
    requires:
      bins: ["oldbin"]
  wingman:
    requires:
      bins: ["newbin"]
---

# dual
`;

		const parsed = parseSkillFrontmatter(content);
		expect(parsed.runtimeMetadata?.namespace).toBe("wingman");
		expect(parsed.runtimeMetadata?.requires.bins).toEqual(["newbin"]);
	});

	it("supports openclaw namespace when wingman is absent", () => {
		const content = `---
name: open
description: Openclaw namespace
metadata:
  openclaw:
    requires:
      bins: ["gog"]
---

# open
`;

		const parsed = parseSkillFrontmatter(content);
		expect(parsed.runtimeMetadata?.namespace).toBe("openclaw");
		expect(parsed.runtimeMetadata?.requires.bins).toEqual(["gog"]);
	});

	it("ignores unsupported namespaces like clawdbot", () => {
		const content = `---
name: legacy
description: Legacy metadata
metadata:
  clawdbot:
    requires:
      bins: ["gog"]
---

# legacy
`;

		const parsed = parseSkillFrontmatter(content);
		expect(parsed.runtimeMetadata).toBeNull();
	});

	it("normalizes allowed tools from either key", () => {
		const content = `---
name: ui-registry
description: UI helpers
allowedTools:
  - ui_registry_list
  - ui_present
---

# ui
`;

		const parsed = parseSkillFrontmatter(content);
		expect(parsed.allowedTools).toEqual(["ui_registry_list", "ui_present"]);
	});
});
