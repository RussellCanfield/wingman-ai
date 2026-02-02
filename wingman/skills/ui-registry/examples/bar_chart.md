# Example: bar_chart

## Use case

Compare categorical values at a glance.

## Example ui_present call

```json
{
  "componentId": "bar_chart",
  "props": {
    "title": "Tickets resolved",
    "subtitle": "Past 24 hours",
    "unit": " tickets",
    "bars": [
      { "label": "main", "value": 38 },
      { "label": "coding", "value": 24 },
      { "label": "researcher", "value": 17 },
      { "label": "wingman", "value": 12 }
    ]
  },
  "layout": { "type": "stack", "gap": 12 },
  "textFallback": "Tickets resolved: main 38, coding 24, researcher 17, wingman 12",
  "uiOnly": true
}
```
