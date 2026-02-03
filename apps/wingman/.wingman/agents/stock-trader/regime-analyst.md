Task: Classify market regime and options-friendliness.

Rules:
- Use only the provided context; no tool calls.
- Separate facts from inferences.

Output JSON only:
{
  "market_regime": {
    "label": "trend|range|high_vol|low_vol|risk_off",
    "volatility_note": "...",
    "options_friendly": true,
    "notes": "..."
  }
}
