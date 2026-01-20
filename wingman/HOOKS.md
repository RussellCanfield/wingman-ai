# Hooks System

Wingman-AI's hooks system allows you to execute custom shell commands at specific lifecycle points during agent execution. This enables powerful automations like running linters after file edits, executing tests after agent completion, and validating commands before execution.

The hooks system follows [Claude Code's hooks pattern](https://code.claude.com/docs/en/hooks) for consistency and familiarity.

## Table of Contents

- [Overview](#overview)
- [Hook Events](#hook-events)
- [Configuration](#configuration)
- [Pattern Matching](#pattern-matching)
- [Hook Input](#hook-input)
- [Exit Codes](#exit-codes)
- [Examples](#examples)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Overview

Hooks are user-configurable shell commands that execute automatically at specific points in the agent lifecycle. They receive context data via JSON on stdin and can:

- **Observe**: Log tool usage, track metrics
- **Validate**: Block dangerous commands, enforce policies
- **Transform**: Format code, run linters
- **Integrate**: Trigger CI/CD, update external systems

### Key Features

- **PreToolUse**: Execute before tools run (blocking - can prevent execution)
- **PostToolUse**: Execute after tools complete (non-blocking)
- **Stop**: Execute when agent finishes (non-blocking)
- **Pattern Matching**: Filter hooks by tool names (pipe-separated, wildcards, regex)
- **Global & Agent-Specific**: Configure hooks globally or per-agent
- **Timeout Control**: Configurable timeouts (default 60 seconds)

## Hook Events

### PreToolUse

Fires **before** a tool executes. Can block tool execution.

**Use cases:**
- Validate command safety before execution
- Check permissions or quotas
- Add logging/auditing
- Prevent destructive operations

**Blocking behavior:** If hook exits with code 2, tool execution is blocked.

### PostToolUse

Fires **after** a tool completes successfully. Non-blocking.

**Use cases:**
- Auto-format files after edits
- Run linters on code changes
- Update indexes or caches
- Log successful operations

**Blocking behavior:** Errors are logged but don't stop agent execution.

### Stop

Fires **after** the agent completes. Non-blocking.

**Use cases:**
- Run tests after code changes
- Create git commits
- Generate reports
- Clean up temporary files

**Blocking behavior:** Errors are logged but don't stop agent completion.

## Configuration

Hooks can be configured globally in `.wingman/wingman.config.json` or per-agent in `.wingman/agents/{name}/agent.json`.

### Global Hooks

File: `.wingman/wingman.config.json`

```json
{
  "logLevel": "info",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "write_file|edit_file",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/format-code.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Agent-Specific Hooks

File: `.wingman/agents/my-agent/agent.json`

```json
{
  "name": "my-agent",
  "description": "My custom agent",
  "systemPrompt": "...",
  "tools": ["command_execute"],
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "command_execute",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/validate-command.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### Configuration Schema

```typescript
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "string",  // Optional: tool pattern (default: match all)
        "hooks": [
          {
            "type": "command",
            "command": "string",  // Shell command to execute
            "timeout": number     // Timeout in seconds (default: 60)
          }
        ]
      }
    ],
    "PostToolUse": [ /* same as PreToolUse */ ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "string",
            "timeout": number
          }
        ]
      }
    ]
  }
}
```

**Note:** Stop hooks don't have a `matcher` field since they apply to agent completion, not tool calls.

## Pattern Matching

The `matcher` field supports flexible patterns for filtering which tools trigger hooks.

### Exact Match

```json
{
  "matcher": "write_file"
}
```

Matches only the `write_file` tool.

### Pipe-Separated (OR)

```json
{
  "matcher": "write_file|edit_file"
}
```

Matches `write_file` OR `edit_file`.

### Wildcard (All Tools)

```json
{
  "matcher": "*"
}
```

or

```json
{
  "matcher": ""
}
```

Matches **all** tools.

### Regex Pattern

```json
{
  "matcher": ".*_file"
}
```

Matches any tool ending with `_file` (like `write_file`, `edit_file`, `read_file`).

**Notes:**
- Matching is **case-sensitive**
- Invalid regex falls back to exact match
- Empty string or `*` matches all tools

## Hook Input

Hooks receive context data as **JSON via stdin**. The structure follows Claude Code's `HookInput` format:

### Common Fields

All hooks receive:

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "cwd": "/path/to/workspace",
  "hook_event_name": "PreToolUse" | "PostToolUse" | "Stop"
}
```

### Tool Hook Fields

PreToolUse and PostToolUse hooks also receive:

```json
{
  "tool_name": "write_file",
  "tool_use_id": "toolu_01ABC123",
  "tool_input": {
    "file_path": "/path/to/file.ts",
    "content": "export const foo = 'bar';"
  }
}
```

### PostToolUse-Only Fields

PostToolUse hooks additionally receive:

```json
{
  "tool_output": "File written successfully"
}
```

### Example Hook Script

```bash
#!/bin/bash
set -e

# Read JSON input
INPUT=$(cat)

# Extract fields with jq
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

echo "Tool: $TOOL_NAME processed file: $FILE_PATH"
exit 0
```

## Exit Codes

Hooks use exit codes to communicate results:

| Exit Code | Meaning | Behavior |
|-----------|---------|----------|
| 0 | Success | Hook completed successfully. Stdout shown in verbose mode. |
| 2 | Blocking Error | **Blocks** the action (PreToolUse only). Stderr shown to user. |
| Other | Non-blocking Error | Hook failed but execution continues. Stderr shown in verbose mode. |

### PreToolUse Blocking Example

```bash
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Block dangerous commands
if [[ "$COMMAND" == *"rm -rf /"* ]]; then
  echo "Dangerous command blocked: $COMMAND" >&2
  exit 2  # Blocking error - tool will NOT execute
fi

exit 0  # Allow tool to execute
```

### Non-blocking Error Example

```bash
#!/bin/bash
# PostToolUse hook - non-blocking

prettier --write "$FILE_PATH" 2>&1

if [ $? -ne 0 ]; then
  echo "Prettier failed but continuing" >&2
  exit 1  # Non-blocking - agent continues
fi

exit 0
```

## Examples

### Example 1: Auto-format After File Edits

**Hook Script:** `hooks/format-code.sh`

```bash
#!/bin/bash
set -e

# Parse JSON input
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Format TypeScript/JavaScript files
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  echo "Formatting $FILE_PATH..."
  prettier --write "$FILE_PATH" 2>&1
fi

# Format JSON files
if [[ "$FILE_PATH" =~ \.json$ ]]; then
  echo "Formatting $FILE_PATH..."
  jq '.' "$FILE_PATH" > "$FILE_PATH.tmp" && mv "$FILE_PATH.tmp" "$FILE_PATH"
fi

exit 0
```

**Configuration:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "write_file|edit_file",
        "hooks": [
          {
            "type": "command",
            "command": "./hooks/format-code.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Example 2: Validate Commands Before Execution

**Hook Script:** `hooks/validate-command.py`

```python
#!/usr/bin/env python3
import json
import sys
import re

# Read hook input
input_data = json.load(sys.stdin)
tool_input = input_data.get("tool_input", {})
command = tool_input.get("command", "")

# Dangerous patterns
dangerous_patterns = [
    r"rm\s+-rf\s+/",
    r"dd\s+if=",
    r"mkfs",
    r":\(\)\{\s*:\|:\&\s*\};:",  # Fork bomb
]

for pattern in dangerous_patterns:
    if re.search(pattern, command):
        print(f"Dangerous command blocked: {command}", file=sys.stderr)
        sys.exit(2)  # Blocking error

# Check for sudo without specific command
if re.match(r"^sudo\s*$", command.strip()):
    print("Interactive sudo not allowed", file=sys.stderr)
    sys.exit(2)

sys.exit(0)  # Allow command
```

**Configuration:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "command_execute",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ./hooks/validate-command.py",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### Example 3: Run Tests After Agent Completes

**Hook Script:** `hooks/run-tests.sh`

```bash
#!/bin/bash
set -e

echo "Running test suite..."

# Run tests with detailed output (works with npm or bun)
bun test 2>&1

if [ $? -eq 0 ]; then
  echo "✓ All tests passed"
  exit 0
else
  echo "✗ Tests failed" >&2
  exit 1  # Non-blocking - just logs failure
fi
```

**Configuration:**

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "./hooks/run-tests.sh",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

### Example 4: Log All Tool Usage

**Hook Script:** `hooks/audit-log.sh`

```bash
#!/bin/bash

# Parse input
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')

# Log to file
echo "$TIMESTAMP | Session: $SESSION_ID | Tool: $TOOL_NAME" >> /tmp/wingman-audit.log

exit 0
```

**Configuration:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "./hooks/audit-log.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

## Security

### Critical Warnings

⚠️ **Hooks execute arbitrary shell commands with your user privileges**

- Can access/modify any files your user can access
- Can make network requests
- Can run destructive commands
- **Malicious hooks can cause data loss or system damage**

### Best Practices

1. **Use Absolute Paths**
   ```json
   {
     "command": "/home/user/wingman/hooks/validate.sh"
   }
   ```

2. **Quote Shell Variables**
   ```bash
   # GOOD
   prettier --write "$FILE_PATH"

   # BAD - vulnerable to injection
   prettier --write $FILE_PATH
   ```

3. **Validate Hook Inputs**
   ```bash
   # Check for path traversal
   if [[ "$FILE_PATH" == *".."* ]]; then
     echo "Invalid path" >&2
     exit 2
   fi
   ```

4. **Set Proper Permissions**
   ```bash
   chmod 700 hooks/*.sh  # Owner only
   ```

5. **Avoid Secrets in Hooks**
   - Never hardcode API keys or passwords
   - Use environment variables or secure vaults

6. **Test in Safe Environments**
   - Test new hooks on non-production data
   - Use version control for hook scripts

7. **Review Hook Configurations**
   - Audit hooks before committing to repository
   - Document what each hook does and why

8. **Limit Hook Scope**
   - Use specific matchers instead of wildcards
   - Set reasonable timeouts
   - Use PreToolUse sparingly (can disrupt agent)

## Troubleshooting

### Hook Not Executing

**Check:**
1. Pattern matcher is correct for the tool
2. Hook script has execute permissions (`chmod +x`)
3. Command path is absolute or in $PATH
4. No syntax errors in configuration JSON

**Debug:**
```bash
# Test hook manually
echo '{"session_id":"test","cwd":"/tmp","hook_event_name":"PostToolUse","tool_name":"write_file","tool_input":{"file_path":"/tmp/test.ts"}}' | ./hooks/your-hook.sh
```

### Hook Timing Out

**Solutions:**
- Increase timeout value
- Optimize hook script performance
- Make hook async if possible (PostToolUse/Stop only)

### Hook Failing Silently

**Check logs:**
- PostToolUse and Stop hooks are non-blocking
- Errors logged to agent logs, not shown to user
- Run with verbose logging: `wingman --verbose`

### PreToolUse Blocking Unexpectedly

**Debug:**
- Check hook exit code (must be exactly 2 to block)
- Review stderr output
- Test hook in isolation

### Permission Denied

**Solutions:**
```bash
# Make hook executable
chmod +x hooks/your-hook.sh

# Check file ownership
ls -l hooks/

# Use absolute path
"command": "/absolute/path/to/hook.sh"
```

### JSON Parsing Errors

**Solutions:**
```bash
# Install jq for JSON parsing
npm install -g jq
# or
brew install jq

# Validate JSON
echo "$INPUT" | jq '.' > /dev/null && echo "Valid JSON"
```

## Advanced Usage

### Multiple Hooks Per Event

```json
{
  "PostToolUse": [
    {
      "matcher": "write_file|edit_file",
      "hooks": [
        {
          "type": "command",
          "command": "./hooks/format.sh",
          "timeout": 30
        },
        {
          "type": "command",
          "command": "./hooks/lint.sh",
          "timeout": 30
        }
      ]
    }
  ]
}
```

All hooks execute in order. For PostToolUse/Stop, execution continues even if earlier hooks fail.

### Global + Agent Hooks

Both global and agent-specific hooks execute. They are concatenated, not merged.

**Global config:**
```json
{
  "hooks": {
    "PostToolUse": [
      {"matcher": "*", "hooks": [{"type": "command", "command": "./global-log.sh"}]}
    ]
  }
}
```

**Agent config:**
```json
{
  "hooks": {
    "PostToolUse": [
      {"matcher": "write_file", "hooks": [{"type": "command", "command": "./format.sh"}]}
    ]
  }
}
```

**Result:** Both hooks execute for `write_file` tool.

### Conditional Execution in Hooks

```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only process files in src/
if [[ ! "$FILE_PATH" =~ ^src/ ]]; then
  exit 0
fi

# Process the file
prettier --write "$FILE_PATH"
```

## Future Enhancements

The following features are planned for future releases:

- Prompt-type hooks (LLM-based decisions)
- Hook output to modify tool inputs
- SessionStart/SessionEnd hooks
- UserPromptSubmit hooks
- Once-only hooks (run once per session)
- Hook deduplication
- Environment variable persistence

## Support

For issues, questions, or feature requests, please visit:
https://github.com/your-repo/wingman-ai/issues
