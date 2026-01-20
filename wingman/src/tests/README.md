# Wingman Testing Guide

This document outlines the testing strategy, structure, and best practices for the Wingman project.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [Best Practices](#best-practices)

## Overview

The Wingman project uses [Vitest](https://vitest.dev/) as the testing framework. Tests are organized into unit tests and integration tests, covering core functionality including:

- **Logger System**: All logger implementations (WingmanLogger, SilentLogger, EventLogger)
- **Hooks System**: Pattern matching, hook execution, and configuration merging
- **CLI Configuration**: Config loading, validation, and defaults
- **Agent Loading**: Agent configuration loading and validation
- **Integration Tests**: Full workflow tests for agent invocation and CLI operations

## Test Structure

```
wingman/src/tests/
├── README.md                                   # This file
├── logger.test.ts                              # Logger system unit tests
├── hooks-matcher.test.ts                       # Hooks pattern matching tests
├── hooks-merger.test.ts                        # Hooks config merging tests
├── cli-config-loader.test.ts                   # CLI configuration tests
└── integration/
    └── agent-invocation.integration.test.ts    # Agent loading integration tests
```

Existing tests (to be maintained):
```
wingman/src/agent/tests/
├── agentConfig.test.ts                         # Agent config schema validation
├── modelFactory.test.ts                        # Model factory tests
├── toolRegistry.test.ts                        # Tool registry tests
└── agentLoader.test.ts                         # Agent loader tests
```

## Running Tests

### All Tests
```bash
bun test
```

### Unit Tests Only
```bash
bun run test:unit
```

### Integration Tests Only
```bash
bun run test:integration
```

### Watch Mode (All)
```bash
bun run test:watch
```

### Watch Mode (Unit Only)
```bash
bun run test:watch:unit
```

### Watch Mode (Integration Only)
```bash
bun run test:watch:integration
```

### Coverage Report
```bash
bun run test:coverage
```

## Writing Tests

### Unit Tests

Unit tests focus on testing individual components in isolation. They should be:
- Fast and independent
- Focused on a single unit of functionality
- Using mocks/stubs for external dependencies

**Example:**

```typescript
import { describe, it, expect, vi } from "vitest";
import { MyClass } from "../path/to/class";

describe("MyClass", () => {
  describe("myMethod", () => {
    it("should return expected result", () => {
      const instance = new MyClass();
      const result = instance.myMethod("input");

      expect(result).toBe("expected output");
    });
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly. They should:
- Test real interactions between components
- Use actual dependencies when possible
- Be placed in the `integration/` subdirectory
- Have `.integration.test.ts` file suffix

**Example:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ComponentA } from "../componentA";
import { ComponentB } from "../componentB";

describe("Integration: ComponentA + ComponentB", () => {
  beforeEach(() => {
    // Setup test environment
  });

  afterEach(() => {
    // Cleanup
  });

  it("should work together to produce result", () => {
    const a = new ComponentA();
    const b = new ComponentB();

    const result = a.process(b.getData());

    expect(result).toBeDefined();
  });
});
```

## Test Coverage

### Current Coverage

The test suite currently covers:

#### Logger System (logger.test.ts)
- ✅ WingmanLogger: Log level filtering, formatting, output streams
- ✅ SilentLogger: No-op behavior for all log levels
- ✅ EventLogger: Event emission, callback invocation
- ✅ Factory functions: createLogger, createEventLogger, createLoggerFromConfig
- ✅ Log level hierarchy validation

#### Hooks System
##### Pattern Matching (hooks-matcher.test.ts)
- ✅ Wildcard patterns: *, empty string, undefined
- ✅ Exact matching: case-sensitive string comparison
- ✅ Pipe-separated lists: "tool1|tool2|tool3"
- ✅ Regex patterns: ".*_file", "^write_.*"
- ✅ findMatchingHooks: Multiple matchers, hook flattening

##### Configuration Merging (hooks-merger.test.ts)
- ✅ Empty configuration handling
- ✅ PreToolUse hooks merging
- ✅ PostToolUse hooks merging
- ✅ Stop hooks merging
- ✅ Order preservation (global first, then agent)
- ✅ Multi-event merging

#### CLI Configuration (cli-config-loader.test.ts)
- ✅ Default configuration values
- ✅ Valid configuration loading
- ✅ Invalid configuration handling
- ✅ Partial configuration merging
- ✅ JSON parsing error handling
- ✅ Schema validation

#### Agent System (integration/agent-invocation.integration.test.ts)
- ✅ Agent loading from filesystem
- ✅ Multiple agent loading
- ✅ Tool configuration
- ✅ Model override support
- ✅ Subagent loading
- ✅ Invalid configuration handling
- ✅ Empty workspace handling

### Coverage Goals

Target coverage metrics:
- **Line Coverage**: > 80%
- **Branch Coverage**: > 75%
- **Function Coverage**: > 85%

### Areas for Future Test Coverage

The following components would benefit from additional test coverage:

#### High Priority
1. **Hook Executor** (`agent/middleware/hooks/executor.ts`)
   - Command execution
   - Timeout handling
   - Exit code handling
   - Blocking vs non-blocking behavior

2. **CLI Output Manager** (`cli/core/outputManager.ts`)
   - Event emission
   - Output mode detection
   - JSON vs Interactive output

3. **Agent Invoker** (`cli/core/agentInvoker.ts`)
   - Direct agent invocation
   - Error handling
   - Event lifecycle

4. **Tools** (`agent/tools/`)
   - `think.ts`: Reasoning tool
   - `internet_search.ts`: Search providers (DuckDuckGo, Perplexity)
   - `web_crawler.ts`: Multi-page crawling
   - `command_execute.ts`: Command execution, blocking, safety

5. **MCP Client Manager** (`agent/config/mcpClientManager.ts`)
   - Server initialization
   - Transport handling (stdio, sse)
   - Tool loading from MCP servers

#### Medium Priority
6. **CLI Commands** (`cli/commands/`)
   - Agent command
   - Skill command

7. **Skill Service** (`cli/services/`)
   - Skill operations
   - Skill repository access

8. **Logger Bridge** (`cli/core/loggerBridge.ts`)
   - Logger to OutputManager bridging

#### Low Priority
9. **Additional Middleware** (`agent/middleware/`)
   - Additional messages middleware

10. **UI Components** (`cli/ui/`)
    - Ink-based components (if testing UI is desired)

## Best Practices

### General Guidelines

1. **Test Naming**: Use descriptive test names that explain what is being tested
   ```typescript
   // Good
   it("should return default config when file doesn't exist", () => { ... })

   // Bad
   it("test1", () => { ... })
   ```

2. **Arrange-Act-Assert**: Structure tests clearly
   ```typescript
   it("should process data correctly", () => {
     // Arrange
     const input = "test data";
     const processor = new DataProcessor();

     // Act
     const result = processor.process(input);

     // Assert
     expect(result).toBe("processed test data");
   });
   ```

3. **Test Independence**: Each test should be independent and not rely on other tests
   ```typescript
   // Use beforeEach for setup
   beforeEach(() => {
     // Fresh setup for each test
   });
   ```

4. **Mock External Dependencies**: Mock external services, APIs, and file system operations
   ```typescript
   const mockFetch = vi.fn(() => Promise.resolve({ data: "test" }));
   ```

5. **Test Error Cases**: Don't just test the happy path
   ```typescript
   describe("error handling", () => {
     it("should throw error for invalid input", () => {
       expect(() => process(null)).toThrow();
     });
   });
   ```

### Vitest-Specific

1. **Use Typed Mocks**: Leverage TypeScript for type-safe mocking
   ```typescript
   import type { LogEventCallback } from "../logger";
   const mockCallback = vi.fn() as LogEventCallback;
   ```

2. **Cleanup**: Always clean up resources in `afterEach` or `afterAll`
   ```typescript
   afterEach(() => {
     vi.clearAllMocks();
     // Other cleanup
   });
   ```

3. **Use Descriptive Matchers**: Choose the most specific matcher
   ```typescript
   // Good
   expect(array).toHaveLength(3);
   expect(string).toContain("substring");

   // Less specific
   expect(array.length).toBe(3);
   expect(string.includes("substring")).toBe(true);
   ```

4. **Group Related Tests**: Use nested `describe` blocks
   ```typescript
   describe("MyClass", () => {
     describe("initialization", () => {
       // Initialization tests
     });

     describe("data processing", () => {
       // Processing tests
     });
   });
   ```

## Continuous Integration

Tests should be run in CI/CD pipelines:
- Run all tests on every pull request
- Fail builds if tests don't pass
- Generate and publish coverage reports
- Run integration tests separately if they're slow

## Debugging Tests

### VSCode

Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Current Test File",
  "autoAttachChildProcesses": true,
  "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
  "program": "${workspaceRoot}/node_modules/vitest/vitest.mjs",
  "args": ["run", "${file}"],
  "smartStep": true,
  "console": "integratedTerminal"
}
```

### Command Line

Run a specific test file:
```bash
bun test src/tests/logger.test.ts
```

Run tests matching a pattern:
```bash
bun test --grep "Logger System"
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [PRD: Multi-Agent Architecture](../../docs/requirements/001-multi-agent-architecture.md)
- [PRD: CLI Direct Invocation](../../docs/requirements/003-cli-direct-invocation.md)

## Contributing

When adding new features:
1. Write tests first (TDD) or alongside the implementation
2. Ensure tests pass before submitting PR
3. Add integration tests for cross-component features
4. Update this README if adding new test categories
5. Aim for >80% coverage on new code

---

**Last Updated**: 2026-01-20
