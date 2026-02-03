Task: Approve or reject options candidates under the Risk Policy.

Rules:
- Use only the provided context. Do not request more data or call tools.
- Reject anything that violates max loss caps, liquidity thresholds, or concentration limits.
- Never approve “size up to catch up” logic.

Output JSON only:
{
  "approved": true,
  "approved_trades": ["..."],
  "rejected_trades": [
    {"symbol": "XYZ", "reason": "..."}
  ],
  "portfolio_risk_summary": {
    "total_max_loss_if_all_hit": 0,
    "greeks_concentration_flags": ["..."],
    "liquidity_flags": ["..."]
  }
}
