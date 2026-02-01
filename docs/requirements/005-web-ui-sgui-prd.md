# PRD-005: Web UI Static Generative UI (SGUI)

**Version:** 1.1
**Status:** In Progress
**Last Updated:** 2026-02-01

---

## Overview

Static Generative UI (SGUI) is a controlled UI pattern where agents select
from pre-registered components and provide data for rendering. The Web UI owns
the component registry, layout, and interaction patterns. Agents never send raw
HTML; they send component IDs + props with optional layout hints and a required
text fallback.

This document defines the UI registry contract, the registry metadata file, and
`ui_registry_*` / `ui_present` tool behavior.

---

## Goals

1. Provide a safe, predictable UI surface for agents
2. Keep layout and styling owned by the Web UI
3. Allow UI rendering to be toggled off gateway-wide
4. Keep agent prompts lean via registry lookup tools

## Non-Goals

- Arbitrary HTML/JS execution from agents
- Replacing the default text chat UI
- Cross-client registry sync in MVP (Web UI only)

---

## UI Registry Contract (Web UI)

- Registry is client-side only in MVP (`registry: "webui"`)
- Components are pre-registered by ID
- Registry metadata is stored in JSON and queried via tools
- Agents select component IDs and provide props; the client validates and renders

### Registry Metadata File

Location:
- `skills/ui-registry/registry.json`

The registry is keyed by component ID so tools can load metadata by key.

```json
{
  "version": 1,
  "components": {
    "stat_grid": {
      "label": "Stat Grid",
      "description": "Compact summary of key stats",
      "useCases": ["Weather snapshot", "KPI summary"],
      "propsSchema": {
        "type": "object",
        "required": ["title", "stats"],
        "properties": {
          "title": { "type": "string" },
          "subtitle": { "type": "string" },
          "stats": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["label", "value"],
              "properties": {
                "label": { "type": "string" },
                "value": { "type": ["string", "number"] },
                "helper": { "type": "string" }
              }
            }
          }
        }
      },
      "exampleRef": "examples/stat_grid.md"
    }
  }
}
```

### Federated Components (Optional)

The registry may include remote (federated) components loaded at runtime via
ESM URLs. Remote components must be explicitly allowlisted by the Web UI build
or configuration and are never loaded from agent-provided URLs.

---

## Layout Hints (Generic Composition)

Clients should support a minimal, generic layout model:
- `stack` (vertical)
- `row` (horizontal)
- `grid` (columns)

Unknown layout properties may be ignored.

```json
{
  "layout": { "type": "stack", "gap": 12 }
}
```

---

## Tool Contracts

These tools are globally available and always included for agents.

### 1) `ui_registry_list`

Lists available UI registry components by key.

Output (example):
```json
{
  "version": 1,
  "components": [
    {
      "id": "stat_grid",
      "label": "Stat Grid",
      "description": "Compact summary of key stats",
      "useCases": ["Weather snapshot", "KPI summary"]
    }
  ]
}
```

### 2) `ui_registry_get`

Returns schema details for a specific component key.

Input:
```json
{ "componentId": "stat_grid" }
```

Output (example):
```json
{
  "componentId": "stat_grid",
  "label": "Stat Grid",
  "description": "Compact summary of key stats",
  "propsSchema": { "type": "object", "required": ["title", "stats"], "properties": { ... } },
  "example": "# Example usage..."
}
```

### 3) `ui_present`

Renders a registered UI component with props and a mandatory text fallback.

Input:
```json
{
  "componentId": "stat_grid",
  "props": {
    "title": "Weather",
    "subtitle": "Seattle, WA",
    "stats": [
      { "label": "Summary", "value": "Cloudy" },
      { "label": "Temperature", "value": "58°F" }
    ]
  },
  "layout": { "type": "stack", "gap": 12 },
  "textFallback": "Seattle, WA: 58°F, Cloudy",
  "uiOnly": true
}
```

Output includes an SGUI render spec:
```json
{
  "ui": {
    "registry": "webui",
    "layout": { "type": "stack", "gap": 12 },
    "components": [
      { "component": "stat_grid", "props": { "title": "Weather", "stats": [ ... ] } }
    ]
  },
  "uiOnly": true,
  "textFallback": "Seattle, WA: 58°F, Cloudy"
}
```

### Text Fallback (Required)

`textFallback` is mandatory for every `ui_present` call. Non-UI clients and
UI-disabled gateways must still display a readable result.

---

## UI-Only Responses

Tools may include `uiOnly: true` to indicate the Web UI should prioritize the
UI render and suppress redundant assistant text for that turn.

For non-UI clients (e.g., Discord), tools should always provide `textFallback`
so users still see a readable result even when `uiOnly` is true.

---

## Dynamic UI Toggle (Gateway Config)

The gateway can disable dynamic UI rendering globally:

```json
{
  "gateway": {
    "dynamicUiEnabled": false
  }
}
```

When disabled:
- Web UI ignores UI render specs
- `ui_present` still requires `textFallback`
- Agents should respond in plain text and avoid UI presentation

---

## Web UI Registry (MVP)

### `stat_grid` (v1.0.0)

```json
{
  "type": "object",
  "required": ["title", "stats"],
  "properties": {
    "title": { "type": "string", "maxLength": 80 },
    "subtitle": { "type": "string", "maxLength": 120 },
    "stats": {
      "type": "array",
      "minItems": 1,
      "maxItems": 8,
      "items": {
        "type": "object",
        "required": ["label", "value"],
        "properties": {
          "label": { "type": "string", "maxLength": 40 },
          "value": { "type": ["string", "number"], "maxLength": 120 },
          "helper": { "type": "string", "maxLength": 80 }
        }
      }
    }
  }
}
```

---

## References

- Gateway PRD: `docs/requirements/002-gateway-prd.md`
- Node Protocol Spec: `docs/requirements/004-node-protocol.md`
- macOS App PRD: `docs/requirements/003-macos-app-prd.md`
