Task: Final review of the Decision Packet draft.

Rules:
- If any guardrail is violated, return VETO and cite the violated rule.
- If edits are required, return APPROVE_WITH_EDITS and specify edits.
- If data_health is below threshold, veto to NO TRADE.

Output (exactly one of the following):
- APPROVE
- APPROVE_WITH_EDITS: <edits>
- VETO: <violated guardrail>
