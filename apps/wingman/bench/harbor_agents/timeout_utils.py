from __future__ import annotations


def resolve_command_timeout(
    *,
    requested_timeout_sec: float,
    is_blocking: bool,
    min_blocking_timeout_sec: float,
    max_timeout_sec: float,
) -> float:
    requested = requested_timeout_sec if requested_timeout_sec > 0 else 1.0
    max_bound = max(max_timeout_sec, 1.0)

    if not is_blocking:
        return min(max(requested, 1.0), min(max_bound, 15.0))

    min_bound = min(max(min_blocking_timeout_sec, 1.0), max_bound)
    return min(max(requested, min_bound), max_bound)
