# Example: area_chart

## Use case

Show a filled trend chart with optional stacking.

## Example ui_present call

```json
{
  "componentId": "area_chart",
  "props": {
    "title": "Capacity usage",
    "subtitle": "Region breakdown",
    "yLabel": "%",
    "xLabel": "Week",
    "showLegend": true,
    "showMarkers": false,
    "stacked": true,
    "series": [
      {
        "name": "US-East",
        "data": [
          { "label": "W1", "value": 32 },
          { "label": "W2", "value": 38 },
          { "label": "W3", "value": 41 },
          { "label": "W4", "value": 45 }
        ]
      },
      {
        "name": "EU",
        "data": [
          { "label": "W1", "value": 21 },
          { "label": "W2", "value": 24 },
          { "label": "W3", "value": 28 },
          { "label": "W4", "value": 31 }
        ]
      }
    ]
  },
  "layout": { "type": "stack", "gap": 12 },
  "textFallback": "Capacity usage: US-East 32-45%, EU 21-31%",
  "uiOnly": true
}
```
