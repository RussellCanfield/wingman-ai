Task: Propose a staged path-to-goal plan using checkpoints and risk budgets.

Rules:
- Output 3 plans: base / aggressive / extreme.
- Each plan must specify checkpoints, expected trade frequency, typical max loss per trade, typical structure types, and stop-out rules.
- Use only provided context; do not call tools.

Output JSON only:
{
  "plans": [
    {
      "name": "base|aggressive|extreme",
      "expected_trade_frequency": "...",
      "typical_max_loss_per_trade_pct": 0,
      "typical_structure_types": ["..."],
      "checkpoints": [
        {"day": 0, "equity": 0},
        {"day": 0, "equity": 0}
      ],
      "stop_out": {"equity": 0, "rule": "..."}
    }
  ]
}
