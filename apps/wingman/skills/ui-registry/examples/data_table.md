# Example: data_table

## Use case

Present structured comparisons in rows and columns.

## Example ui_present call

```json
{
  "componentId": "data_table",
  "props": {
    "title": "Model comparison",
    "subtitle": "Coding workload",
    "striped": true,
    "columns": [
      { "key": "model", "label": "Model" },
      { "key": "latency", "label": "Latency", "align": "right" },
      { "key": "cost", "label": "Cost", "align": "right" },
      { "key": "score", "label": "Quality", "align": "right" }
    ],
    "rows": [
      { "model": "gpt-4o", "latency": "1.8s", "cost": "$0.04", "score": 92 },
      { "model": "gpt-4o-mini", "latency": "0.9s", "cost": "$0.01", "score": 85 },
      { "model": "claude-3.5", "latency": "2.1s", "cost": "$0.05", "score": 94 }
    ]
  },
  "layout": { "type": "stack", "gap": 12 },
  "textFallback": "Model comparison: gpt-4o 1.8s $0.04 score 92; gpt-4o-mini 0.9s $0.01 score 85; claude-3.5 2.1s $0.05 score 94",
  "uiOnly": true
}
```
