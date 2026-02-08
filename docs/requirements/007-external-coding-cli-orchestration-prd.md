# PRD-007: External Coding CLI Orchestration

**Version:** 0.1 (Draft)
**Status:** Draft
**Last Updated:** 2026-02-08

---

## Overview

Wingman needs a reliable way to leverage external coding CLIs (for example, Codex CLI, Claude Code CLI, Copilot CLI, and OpenCode CLI) inside the multi-agent architecture without degrading UX, safety, or determinism.

This PRD defines a phased approach to integrate those CLIs through a dedicated orchestration pattern, while addressing a core risk: external CLIs may unexpectedly enter interactive prompt flows.

---

## Problem Statement

External coding CLIs are powerful executors, but they are not uniformly designed for deterministic non-interactive automation. In autonomous flows, they can:

- Pause and ask follow-up questions mid-run
- Require TTY semantics that differ across tools
- Behave differently between interactive and non-interactive flags
- Emit output patterns that are difficult to parse reliably for orchestration

Without a clear protocol and runtime policy, this creates stuck runs, unclear user experience, and unsafe execution paths.

---

## Goals

1. Enable Wingman agents to use external coding CLIs predictably.
2. Preserve seamless user experience when additional user input is required.
3. Keep orchestration aligned with Wingman’s root + subagent model.
4. Enforce safety and observability across CLI execution.
5. Create a path to richer protocol-level integration without blocking MVP.

## Non-Goals

- Replacing native Wingman implementation agents.
- Building full terminal emulation for every external CLI in MVP.
- Guaranteeing feature parity across all external CLIs on day one.

---

## Current Context

Wingman already supports:

- Root/subagent orchestration patterns (PRD-001)
- Tool execution through `command_execute`
- Tool-driven UI prompts via static generative UI hints (Gateway/Web UI)
- Planned gateway node protocol for streamed remote execution

Current limitation:

- `command_execute` is effectively one-shot and not designed for full interactive stdin/TTY dialogue. This limits seamless handling of surprise prompts from external CLIs.

---

## Key Challenges

### 1) Interactive Prompt Uncertainty
External CLIs may ask arbitrary questions mid-run (for example: “What is your favorite color?”).

Impact:
- Agent run can stall or timeout
- User does not get a clean question/answer handoff

### 2) Interactive vs Non-Interactive Inconsistency
Different CLIs expose different flags and defaults for non-interactive behavior.

Impact:
- Adapter complexity and brittle assumptions
- Per-CLI execution policies are required

### 3) Input/Output Contract Drift
CLI output is not standardized across tools and versions.

Impact:
- Harder to classify completion vs blocked state vs request-for-input

### 4) Safety + Approval Surface
Shelling out to third-party CLIs expands execution and side-effect risk.

Impact:
- Requires explicit allowlists, blocking rules, and policy hooks

### 5) UX Continuity
Users expect one coherent conversation even if work is delegated to external executors.

Impact:
- Orchestrator must normalize external CLI behavior back into Wingman-native prompts/results

---

## Options Considered

### Option A: Pure `command_execute` Subagent (Immediate)
Use a CLI-runner subagent that calls external CLIs via `command_execute`.

Pros:
- Fastest path
- Reuses existing tooling and agent model

Cons:
- Weak support for mid-run arbitrary interactive prompts
- Requires strict non-interactive policy to avoid stalls

### Option B: ACP-First Integration
Adopt Agent Client Protocol as the primary integration contract for external coding CLIs.

Pros:
- More structured sessions, events, and tool lifecycle
- Better long-term interoperability when provider support matures

Cons:
- ACP support is still uneven across tools
- ACP does not by itself guarantee arbitrary mid-run user question handoff semantics
- Higher initial implementation cost

### Option C: Hybrid (Recommended)
Start with Option A under strict policy, then evolve to protocol-level integrations (ACP and/or gateway node pattern) for tools that benefit from richer session control.

Pros:
- Delivers near-term value
- Preserves architecture alignment
- Avoids blocking on ecosystem maturity

Cons:
- Requires adapter abstraction to avoid duplicated logic later

---

## Recommended Architecture

### A) Orchestrator + CLI Runner Subagent
- Root orchestrator remains the user-facing coordinator.
- A dedicated `cli-runner` subagent owns external CLI invocation.
- Root agent gathers required inputs before delegation whenever possible.

### B) CLI Adapter Contract (Per Tool)
Each supported CLI implements an adapter with:
- `prepare(input): PreparedRun`
- `buildCommand(prepared): string`
- `parseOutput(raw): RunOutcome`
- `detectPromptOrStall(raw, timing): PromptSignal | null`
- `mapError(raw): NormalizedError`

### C) Strict Non-Interactive Default
MVP execution policy:
- Non-interactive flags/env enabled by default
- No long-lived TTY sessions by default
- Idle timeout + max duration enforced
- Known prompt/stall signatures trigger controlled abort

### D) Clarification Loop
If required input is missing or prompt is detected:
1. Stop/abort external CLI run
2. Ask user via Wingman-native response (optionally SGUI prompt)
3. Re-run CLI with clarified input

### E) Observability Envelope
Track per run:
- command fingerprint + adapter id
- duration, exit code, timeout/stall reason
- retry count and clarification count
- normalized summary for user-facing output

---

## ACP Fit and Limits

ACP is a strong candidate for future protocol normalization, especially for:
- Session lifecycle and streaming event structure
- Permission-oriented checkpoints
- Multi-client interoperability

However, ACP alone should not be treated as a complete solution for arbitrary mid-run user Q&A until explicit interaction patterns are standardized or extended.

Draft stance:
- Use ACP where available and beneficial
- Keep Wingman clarification loop authoritative
- Allow protocol extensions or fallback turn-based prompts for unresolved interaction gaps

---

## Security and Governance

1. External CLI allowlist by executable name/path.
2. Keep destructive command blocks and policy hooks in effect.
3. Record approval/audit metadata for external-run actions.
4. Scope workspaces and output paths per agent.
5. Apply least-privilege environment shaping.

---

## UX Requirements

1. User should always know when work is delegated to an external CLI.
2. If input is required, user receives a direct Wingman question, not a silent stall.
3. Final response must summarize what changed and why.
4. Failed runs must return actionable next steps.

---

## Phased Rollout

### Phase 1: MVP (Non-Interactive Only)
- Add `cli-runner` subagent pattern
- Support 1-2 external CLIs behind adapters
- Enforce strict non-interactive policy
- Implement stall detection + clarification loop

### Phase 2: Session Enrichment
- Add richer event mapping and incremental output normalization
- Improve prompt detection heuristics per CLI
- Expand adapter coverage

### Phase 3: Protocol Expansion
- Integrate ACP-capable providers where practical
- Define Wingman interaction extensions for unresolved gaps
- Evaluate gateway node routing for remote executor scenarios

---

## Acceptance Criteria (Draft)

1. External CLI run never hangs indefinitely without user-visible state.
2. Surprise prompt scenarios convert into explicit Wingman clarification turns.
3. Non-interactive happy-path succeeds for supported CLIs in common coding tasks.
4. Orchestrator preserves coherent conversation context across retries.
5. Safety policies remain enforced for all external CLI execution paths.

---

## Example Scenario

User: “Add my favorite color to README.”

Expected flow:
1. Orchestrator checks for missing value (`favorite color`).
2. Orchestrator asks user directly before external execution.
3. User answers: “Blue.”
4. `cli-runner` executes external CLI in non-interactive mode.
5. Result is returned as normalized Wingman summary with file diff context.

Fallback behavior:
- If CLI still asks mid-run, run is aborted and re-routed through the clarification loop.

---

## References

- `docs/requirements/001-multi-agent-architecture.md`
- `docs/requirements/002-gateway-prd.md`
- `docs/requirements/004-node-protocol.md`
