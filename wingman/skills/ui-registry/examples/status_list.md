# Example: status_list

## Use case

Show health and state indicators for multiple services or tasks.

## Example ui_present call

```json
{
  "componentId": "status_list",
  "props": {
    "title": "Service health",
    "subtitle": "Gateway cluster",
    "items": [
      { "label": "Gateway API", "status": "ok", "value": "Healthy" },
      { "label": "Agent router", "status": "warning", "value": "Degraded", "helper": "High latency" },
      { "label": "Vector store", "status": "pending", "value": "Reindexing" },
      { "label": "Webhook runner", "status": "ok", "value": "Stable" }
    ]
  },
  "layout": { "type": "stack", "gap": 12 },
  "textFallback": "Service health: Gateway API healthy, Agent router degraded (high latency), Vector store reindexing, Webhook runner stable",
  "uiOnly": true
}
```
