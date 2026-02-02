# Example: timeline

## Use case

Track sequential events for incidents or workflows.

## Example ui_present call

```json
{
  "componentId": "timeline",
  "props": {
    "title": "Incident timeline",
    "subtitle": "US-East outage",
    "items": [
      {
        "time": "09:12",
        "title": "Alert triggered",
        "description": "Elevated error rates detected",
        "status": "warning",
        "tag": "P1"
      },
      {
        "time": "09:18",
        "title": "Triage started",
        "description": "On-call engaged and mitigations scoped",
        "status": "info"
      },
      {
        "time": "09:27",
        "title": "Rollback deployed",
        "description": "Traffic stabilized within 5 minutes",
        "status": "success"
      }
    ]
  },
  "layout": { "type": "stack", "gap": 12 },
  "textFallback": "Incident timeline: 09:12 alert triggered; 09:18 triage started; 09:27 rollback deployed",
  "uiOnly": true
}
```
