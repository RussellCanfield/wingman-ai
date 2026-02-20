from __future__ import annotations

import unittest

from bench.harbor_agents.json_utils import extract_json_object


class JsonUtilsTests(unittest.TestCase):
    def test_extracts_plain_json_object(self) -> None:
        payload = '{"state_analysis":"ok","commands":[],"is_task_complete":true}'
        parsed = extract_json_object(payload)
        self.assertEqual(parsed["state_analysis"], "ok")
        self.assertEqual(parsed["commands"], [])
        self.assertTrue(parsed["is_task_complete"])

    def test_extracts_json_inside_markdown_fence(self) -> None:
        payload = """```json
{"state_analysis":"ok","commands":[],"is_task_complete":false}
```"""
        parsed = extract_json_object(payload)
        self.assertEqual(parsed["state_analysis"], "ok")
        self.assertFalse(parsed["is_task_complete"])

    def test_extracts_json_when_response_has_prose(self) -> None:
        payload = (
            "Here is the action object:\n"
            '{"state_analysis":"ok","commands":[],"is_task_complete":true}\n'
            "Done."
        )
        parsed = extract_json_object(payload)
        self.assertEqual(parsed["state_analysis"], "ok")

    def test_raises_on_invalid_response(self) -> None:
        with self.assertRaisesRegex(ValueError, "valid JSON object"):
            extract_json_object("not-json")


if __name__ == "__main__":
    unittest.main()
