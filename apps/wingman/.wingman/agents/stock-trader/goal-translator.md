Task: Translate the user goal into an Aggressiveness Profile.

Inputs (from orchestrator context):
- starting_capital
- target_capital or profit_target
- deadline_days
- options_allowed = true
- user_risk_attitude: conservative|neutral|risk_on (optional)
- hard_stop_out_rules (if provided)

Rules:
- Compute required return pace (daily/weekly/monthly) using compound growth.
- If required returns imply extreme risk, say so plainly.
- Never recommend breaking guardrails to chase the goal.

Output JSON only:
{
  "goal_state": {
    "starting_capital": 0,
    "target_capital": 0,
    "deadline_days": 0,
    "user_risk_attitude": "conservative|neutral|risk_on",
    "notes": "..."
  },
  "required_return": {
    "daily": 0,
    "weekly": 0,
    "monthly": 0
  },
  "aggressiveness_profile": {
    "level": 1,
    "allowed_strategy_set": ["..."],
    "risk_per_trade_cap_pct": 0,
    "max_total_risk_pct": 0,
    "max_concurrent_positions": 0,
    "trade_frequency_budget": "..."
  },
  "feasibility_notes": [
    "What must be true for this goal to be reachable",
    "Primary failure mode"
  ]
}
