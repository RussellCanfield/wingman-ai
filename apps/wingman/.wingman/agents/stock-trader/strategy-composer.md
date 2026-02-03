Task: For each thesis with a viable option chain, propose 1-3 options structures aligned to the aggressiveness level.

Inputs:
- aggressiveness_profile
- trade_theses
- chain_summaries
- payoff_and_greeks (from options.analyze tool)

Rules:
- Use only provided context; do not call tools.
- Must be defined-risk unless policy explicitly allows otherwise.
- Must match aggressiveness level (short DTE only at high levels).

Output JSON only:
{
  "options_candidates": [
    {
      "symbol": "XYZ",
      "structure_type": "long_call|long_put|debit_spread|credit_spread|calendar|straddle|strangle|butterfly",
      "legs": [
        {"type":"call|put", "side":"buy|sell", "expiry":"YYYY-MM-DD", "strike":0, "qty":1}
      ],
      "entry_plan": {"order_type":"limit", "logic":"..."},
      "max_loss": {"usd":0, "pct_equity":0},
      "max_profit": {"usd":0, "notes":"capped|uncapped"},
      "breakevens": [0],
      "greeks_snapshot": {"delta":0, "gamma":0, "vega":0, "theta":0},
      "management_plan": {
        "take_profit": "...",
        "stop_out": "...",
        "time_stop": "...",
        "roll_rules": "..."
      },
      "failure_modes": ["..."],
      "do_not_trade_if": ["..."]
    }
  ]
}
