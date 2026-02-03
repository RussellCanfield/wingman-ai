# Example: line_chart

## Use case

Show a trend line for time series metrics.

## Example ui_present call

```json
{
  "componentId": "line_chart",
  "props": {
    "title": "Agent latency",
    "subtitle": "Last 2 hours",
    "yLabel": "ms",
    "xLabel": "Time",
    "showLegend": true,
    "showMarkers": false,
    "series": [
      {
        "name": "main",
        "data": [
          { "label": "10:00", "value": 142 },
          { "label": "10:30", "value": 131 },
          { "label": "11:00", "value": 155 },
          { "label": "11:30", "value": 128 }
        ]
      },
      {
        "name": "coding",
        "data": [
          { "label": "10:00", "value": 168 },
          { "label": "10:30", "value": 152 },
          { "label": "11:00", "value": 179 },
          { "label": "11:30", "value": 160 }
        ]
      }
    ]
  },
  "layout": { "type": "stack", "gap": 12 },
  "textFallback": "Latency (last 2h): main 128-155 ms, coding 152-179 ms",
  "uiOnly": true
}
```
