from __future__ import annotations

import json
from typing import Any


def _extract_brace_candidates(text: str) -> list[str]:
    candidates: list[str] = []
    starts: list[int] = []
    for index, char in enumerate(text):
        if char == "{":
            starts.append(index)
            continue
        if char != "}" or not starts:
            continue
        start = starts.pop()
        candidate = text[start : index + 1]
        if candidate:
            candidates.append(candidate)
    return candidates


def extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if not text:
        raise ValueError("Assistant returned empty response.")

    fence_start = text.find("```")
    if fence_start >= 0:
        fence_end = text.rfind("```")
        if fence_end > fence_start:
            fenced = text[fence_start + 3 : fence_end].strip()
            if fenced.lower().startswith("json"):
                fenced = fenced[4:].strip()
            if fenced:
                text = fenced

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    for candidate in _extract_brace_candidates(text):
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    raise ValueError("Assistant did not return valid JSON object.")
