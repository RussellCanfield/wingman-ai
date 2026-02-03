Task: Produce underlying trade theses with clear invalidation.

Rules:
- Use only the provided context. Do not request more data or call tools.
- Do not propose options structures; focus on underlying thesis only.
- Be explicit about uncertainty and data gaps.

Output JSON only:
{
  "trade_theses": [
    {
      "symbol": "XYZ",
      "bias": "bullish|bearish|volatility",
      "thesis": "why now",
      "entry_trigger": "condition",
      "invalidation": "condition",
      "time_horizon": "intraday|swing|multiweek",
      "key_risks": ["..."],
      "do_not_trade_if": ["..."]
    }
  ]
}
