from __future__ import annotations

import json
import math
import select
import subprocess
import traceback
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from bench.harbor_agents.json_utils import extract_json_object
from bench.harbor_agents.timeout_utils import resolve_command_timeout
from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


BRIDGE_PROMPT = """You are controlling a terminal via a command bridge.

Return JSON only (no markdown, no prose outside JSON) with this schema:
{
  "state_analysis": "short diagnosis",
  "explanation": "what your next commands do",
  "commands": [
    {
      "keystrokes": "shell command",
      "is_blocking": true,
      "timeout_sec": 120
    }
  ],
  "is_task_complete": false
}

Rules:
- Use at most 4 commands.
- Commands must be non-interactive shell commands.
- Use larger timeouts (120-300s) for install/build/test commands that may take time.
- If task is done, set "is_task_complete": true and "commands": [].

Task instruction:
__INSTRUCTION__

Current terminal state:
__TERMINAL_STATE__
"""


class BridgeCommand(BaseModel):
    keystrokes: str = Field(min_length=1)
    is_blocking: bool = True
    timeout_sec: float = 30.0


class BridgeAction(BaseModel):
    state_analysis: str = ""
    explanation: str = ""
    commands: list[BridgeCommand] = []
    is_task_complete: bool = False


def _to_float(value: Any, default: float) -> float:
    if value is None:
        return default
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    if parsed <= 0:
        return default
    return parsed


def _to_int(value: Any, default: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    if parsed <= 0:
        return default
    return parsed


def _append_tail(text: str, extra: str, limit: int = 24_000) -> str:
    merged = f"{text}\n{extra}".strip()
    if len(merged) <= limit:
        return merged
    return merged[-limit:]


def _parse_pwd(stdout: str) -> str | None:
    lines = [line.strip() for line in stdout.splitlines() if line.strip()]
    if not lines:
        return None
    return lines[-1]


class WingmanBridgeAgent(BaseAgent):
    @staticmethod
    def name() -> str:
        return "wingman-bridge"

    def __init__(
        self,
        logs_dir: Path,
        model_name: str | None = None,
        wingman_agent: str = "coding",
        wingman_model: str | None = None,
        bridge_script_path: str = "scripts/wingman-harbor-bridge.ts",
        bridge_runtime: str = "bun",
        bridge_log_level: str = "silent",
        workspace: str | None = None,
        config_dir: str = ".wingman",
        workdir: str | None = None,
        max_steps: int | str = 50,
        invoke_timeout_sec: float | str = 180.0,
        max_command_timeout_sec: float | str = 180.0,
        min_blocking_command_timeout_sec: float | str = 120.0,
        bridge_start_timeout_sec: float | str = 20.0,
        max_parse_retries: int | str = 3,
        **kwargs,
    ):
        super().__init__(logs_dir=logs_dir, model_name=model_name, **kwargs)
        self._wingman_agent = wingman_agent
        self._wingman_model = wingman_model
        self._bridge_runtime = bridge_runtime
        self._bridge_log_level = bridge_log_level
        self._workspace = Path(workspace) if workspace else Path.cwd()
        self._config_dir = config_dir
        self._workdir = workdir
        script_path = Path(bridge_script_path)
        self._bridge_script_path = (
            script_path if script_path.is_absolute() else self._workspace / script_path
        )
        self._max_steps = _to_int(max_steps, 50)
        self._invoke_timeout_sec = _to_float(invoke_timeout_sec, 180.0)
        self._max_command_timeout_sec = _to_float(max_command_timeout_sec, 180.0)
        self._min_blocking_command_timeout_sec = min(
            _to_float(min_blocking_command_timeout_sec, 120.0),
            self._max_command_timeout_sec,
        )
        self._bridge_start_timeout_sec = _to_float(bridge_start_timeout_sec, 20.0)
        self._max_parse_retries = _to_int(max_parse_retries, 3)

        self._bridge: subprocess.Popen[str] | None = None
        self._request_counter = 0

    def version(self) -> str:
        return "0.1.0"

    async def setup(self, environment: BaseEnvironment) -> None:
        _ = environment
        return

    def _build_prompt(self, instruction: str, terminal_state: str) -> str:
        return (
            BRIDGE_PROMPT.replace("__INSTRUCTION__", instruction)
            .replace("__TERMINAL_STATE__", terminal_state[-20_000:])
        )

    def _start_bridge(self) -> None:
        if self._bridge and self._bridge.poll() is None:
            return

        if not self._bridge_script_path.exists():
            raise FileNotFoundError(
                f"Bridge script not found at {self._bridge_script_path}"
            )

        cmd = [
            self._bridge_runtime,
            str(self._bridge_script_path),
            "--agent",
            self._wingman_agent,
            "--workspace",
            str(self._workspace),
            "--config-dir",
            self._config_dir,
            "--log-level",
            self._bridge_log_level,
        ]
        if self._wingman_model:
            cmd.extend(["--model", self._wingman_model])
        if self._workdir:
            cmd.extend(["--workdir", self._workdir])

        self._bridge = subprocess.Popen(
            cmd,
            cwd=self._workspace,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        ping = self._request({"type": "ping"}, self._bridge_start_timeout_sec)
        if not ping.get("ok"):
            raise RuntimeError(f"Bridge ping failed: {ping.get('error', 'unknown')}")

    def _stop_bridge(self) -> None:
        if not self._bridge:
            return
        try:
            if self._bridge.poll() is None:
                self._bridge.terminate()
                self._bridge.wait(timeout=2)
        except Exception:
            try:
                if self._bridge.poll() is None:
                    self._bridge.kill()
            except Exception:
                pass
        self._bridge = None

    def __del__(self) -> None:
        self._stop_bridge()

    def _request(self, payload: dict[str, Any], timeout_sec: float) -> dict[str, Any]:
        self._start_bridge()
        if not self._bridge or not self._bridge.stdin or not self._bridge.stdout:
            raise RuntimeError("Bridge process is not available.")

        self._request_counter += 1
        request_id = str(self._request_counter)
        message = {"id": request_id, **payload}
        self._bridge.stdin.write(json.dumps(message) + "\n")
        self._bridge.stdin.flush()

        stdout_fd = self._bridge.stdout.fileno()
        ready, _, _ = select.select([stdout_fd], [], [], timeout_sec)
        if not ready:
            raise TimeoutError(f"Bridge response timed out after {timeout_sec} seconds")

        while True:
            line = self._bridge.stdout.readline()
            if not line:
                stderr = ""
                if self._bridge.stderr:
                    try:
                        stderr = self._bridge.stderr.read().strip()
                    except Exception:
                        stderr = ""
                raise RuntimeError(
                    "Bridge process exited unexpectedly"
                    + (f": {stderr}" if stderr else "")
                )

            try:
                response = json.loads(line)
            except json.JSONDecodeError:
                continue

            if not isinstance(response, dict):
                continue
            if response.get("id") != request_id:
                continue
            return response

    async def _detect_cwd(self, environment: BaseEnvironment) -> str | None:
        result = await environment.exec(command="pwd", timeout_sec=10)
        if result.return_code != 0 or not result.stdout:
            return None
        return _parse_pwd(result.stdout)

    async def _run_shell_command(
        self,
        environment: BaseEnvironment,
        command: str,
        cwd: str | None,
        timeout_sec: int,
    ) -> tuple[str | None, str]:
        cmd = command.strip()
        if cmd.lower().startswith("cd "):
            cd_result = await environment.exec(
                command=f"{cmd} && pwd",
                cwd=cwd,
                timeout_sec=min(timeout_sec, 30),
            )
            if cd_result.return_code == 0:
                new_cwd = _parse_pwd(cd_result.stdout or "")
                if new_cwd:
                    return new_cwd, f"$ {cmd}\n{new_cwd}"
            stderr = cd_result.stderr or cd_result.stdout or "cd failed"
            return cwd, f"$ {cmd}\n{stderr.strip()}\n(exit {cd_result.return_code})"

        result = await environment.exec(
            command=cmd,
            cwd=cwd,
            timeout_sec=timeout_sec,
        )
        stdout = (result.stdout or "").strip()
        stderr = (result.stderr or "").strip()
        body_parts = [part for part in [stdout, stderr] if part]
        body = "\n".join(body_parts)
        if body:
            return cwd, f"$ {cmd}\n{body}\n(exit {result.return_code})"
        return cwd, f"$ {cmd}\n(exit {result.return_code})"

    async def run(
        self,
        instruction: str,
        environment: BaseEnvironment,
        context: AgentContext,
    ) -> None:
        total_input_tokens = 0
        total_output_tokens = 0
        terminal_state = "No command output yet."
        parse_retries = 0
        steps_executed = 0
        cwd = await self._detect_cwd(environment)
        if cwd:
            terminal_state = f"Current directory: {cwd}"

        try:
            for step in range(self._max_steps):
                prompt = self._build_prompt(instruction, terminal_state)
                response = self._request(
                    {"type": "invoke", "prompt": prompt},
                    self._invoke_timeout_sec,
                )

                if not response.get("ok"):
                    raise RuntimeError(str(response.get("error", "Bridge invoke failed")))

                assistant_text = str(response.get("assistantText") or "").strip()
                token_usage = response.get("tokenUsage")
                if isinstance(token_usage, dict):
                    total_input_tokens += _to_int(token_usage.get("inputTokens"), 0)
                    total_output_tokens += _to_int(token_usage.get("outputTokens"), 0)

                try:
                    parsed_json = extract_json_object(assistant_text)
                    action = BridgeAction.model_validate(parsed_json)
                    parse_retries = 0
                except (ValueError, ValidationError) as exc:
                    parse_retries += 1
                    (self.logs_dir / f"bridge-step-{step + 1:03d}.invalid.json").write_text(
                        json.dumps(
                            {
                                "prompt": prompt,
                                "assistant_text": assistant_text,
                                "bridge_response": response,
                                "error": str(exc),
                                "parse_retries": parse_retries,
                            },
                            indent=2,
                        )
                    )
                    terminal_state = _append_tail(
                        terminal_state,
                        "Bridge response parse failed. "
                        "Return only one JSON object matching the schema with no markdown."
                        f"\nParser error: {exc}",
                    )
                    if parse_retries > self._max_parse_retries:
                        raise ValueError(
                            "Exceeded bridge JSON parse retries. "
                            f"Last parse error: {exc}"
                        ) from exc
                    continue

                (self.logs_dir / f"bridge-step-{step + 1:03d}.json").write_text(
                    json.dumps(
                        {
                            "prompt": prompt,
                            "assistant_text": assistant_text,
                            "action": action.model_dump(),
                            "bridge_response": response,
                            "cwd": cwd,
                        },
                        indent=2,
                    )
                )
                steps_executed = step + 1

                for command in action.commands:
                    keystrokes = command.keystrokes.strip()
                    if not keystrokes:
                        continue
                    if keystrokes in {"C-c", "CTRL-C", "^C"}:
                        terminal_state = _append_tail(
                            terminal_state,
                            "$ C-c\nSkipped control key (non-interactive mode).",
                        )
                        continue

                    timeout_sec = resolve_command_timeout(
                        requested_timeout_sec=command.timeout_sec,
                        is_blocking=command.is_blocking,
                        min_blocking_timeout_sec=self._min_blocking_command_timeout_sec,
                        max_timeout_sec=self._max_command_timeout_sec,
                    )

                    cwd, command_output = await self._run_shell_command(
                        environment=environment,
                        command=keystrokes,
                        cwd=cwd,
                        timeout_sec=max(1, int(math.ceil(timeout_sec))),
                    )
                    terminal_state = _append_tail(terminal_state, command_output)

                if action.is_task_complete:
                    break

            context.n_input_tokens = total_input_tokens
            context.n_output_tokens = total_output_tokens
            context.metadata = {
                "wingman_bridge": {
                    "steps": steps_executed,
                    "cwd": cwd,
                    "parse_retries": parse_retries,
                }
            }
        except (ValueError, ValidationError) as exc:
            (self.logs_dir / "bridge-error.txt").write_text(
                f"Parse error: {exc}\n\n{traceback.format_exc()}"
            )
            context.metadata = {"bridge_error": f"parse_error: {exc}"}
        except TimeoutError as exc:
            (self.logs_dir / "bridge-error.txt").write_text(
                f"Timeout: {exc}\n\n{traceback.format_exc()}"
            )
            context.metadata = {"bridge_error": f"timeout: {exc}"}
        except Exception as exc:
            (self.logs_dir / "bridge-error.txt").write_text(
                f"{exc}\n\n{traceback.format_exc()}"
            )
            context.metadata = {"bridge_error": str(exc)}
        finally:
            self._stop_bridge()
