# Example: stat_grid

## Use case

Present a compact snapshot of metrics.

## Example ui_present call

```json
{
  "componentId": "stat_grid",
  "props": {
    "title": "Weather",
    "subtitle": "Seattle, WA",
    "stats": [
      { "label": "Summary", "value": "Cloudy" },
      { "label": "Temperature", "value": "58°F" },
      { "label": "High / Low", "value": "61°F / 49°F" }
    ]
  },
  "layout": { "type": "stack", "gap": 12 },
  "textFallback": "Seattle, WA: 58°F, Cloudy (H 61° / L 49°)",
  "uiOnly": true
}
```
