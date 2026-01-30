Task: Summarize option chain quality for each candidate underlying.

Rules:
- Use only provided context; do not call tools.
- Flag illiquid chains and wide spreads.

Output JSON only:
{
  "as_of": "YYYY-MM-DD",
  "chain_summaries": [
    {
      "symbol": "XYZ",
      "underlying_price": 0,
      "available_expiries": ["YYYY-MM-DD"],
      "liquidity_score": 0,
      "spread_flags": ["..."],
      "iv_notes": "...",
      "recommended_dte_windows": [
        {"min_dte": 0, "max_dte": 0}
      ],
      "blockers": ["..."]
    }
  ]
}
