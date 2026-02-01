---
name: ui-registry
description: Select and render pre-registered UI components via the ui_registry_* and ui_present tools.
allowedTools:
  - ui_registry_list
  - ui_registry_get
  - ui_present
---

# UI Registry Skill

Use this skill to render Static Generative UI (SGUI) components. The registry
is keyed by component ID. Keep prompts lean by selecting a key first, then
pulling schema details only when needed.

## Registry keys

- `stat_grid` — Compact summary of key stats (use for weather, KPIs, status)

## Recommended flow

1. Pick a component key from the list above.
2. Call `ui_registry_get` for schema details and examples.
3. Call `ui_present` with `componentId`, `props`, and a required `textFallback`.

## Notes

- `textFallback` is mandatory for every `ui_present` call.
- Use `uiOnly: true` when the UI is the primary response.
