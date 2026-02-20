from __future__ import annotations

import unittest

from bench.harbor_agents.timeout_utils import resolve_command_timeout


class TimeoutUtilsTests(unittest.TestCase):
    def test_blocking_commands_honor_min_timeout_floor(self) -> None:
        timeout = resolve_command_timeout(
            requested_timeout_sec=30,
            is_blocking=True,
            min_blocking_timeout_sec=120,
            max_timeout_sec=600,
        )
        self.assertEqual(timeout, 120)

    def test_blocking_commands_respect_max_timeout(self) -> None:
        timeout = resolve_command_timeout(
            requested_timeout_sec=800,
            is_blocking=True,
            min_blocking_timeout_sec=120,
            max_timeout_sec=600,
        )
        self.assertEqual(timeout, 600)

    def test_non_blocking_commands_are_capped_at_15_seconds(self) -> None:
        timeout = resolve_command_timeout(
            requested_timeout_sec=120,
            is_blocking=False,
            min_blocking_timeout_sec=120,
            max_timeout_sec=600,
        )
        self.assertEqual(timeout, 15)


if __name__ == "__main__":
    unittest.main()
