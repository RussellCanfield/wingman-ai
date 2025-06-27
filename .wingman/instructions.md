# Wingman AI CLI - Development Instructions

## Logging System

The CLI uses **pino**, a high-performance JSON logger for Node.js, to provide comprehensive debugging and monitoring capabilities.

### Configuring Log Levels

**Via CLI Flag:**
```bash
wingman --log-level debug "your prompt here"
wingman -l trace "your prompt here"
```

**Via Environment Variable:**
```bash
WINGMAN_LOG_LEVEL=debug wingman "your prompt here"
```

**Available Log Levels:**
- `trace` - Most verbose, includes all debug info and fine-grained tracing
- `debug` - Detailed debugging information (default in development)
- `info` - General information (default in production)
- `warn` - Warning messages only
- `error` - Error messages only
- `fatal` - Fatal errors only

### Log File Location

Logs are written to: `.wingman/debug.log` in the current working directory

### Viewing Logs

**Show debug information:**
```bash
wingman debug
```

**Follow logs in real-time:**
```bash
tail -f .wingman/debug.log
```

**Pretty-print recent logs:**
```bash
cat .wingman/debug.log | npx pino-pretty
```

### What Gets Logged

The logging system captures comprehensive information across all components:

#### CLI Level (`component: "CLI"`)
- Application startup/shutdown with system information
- Command line arguments and configuration
- Performance metrics for major operations
- Error conditions during startup

#### UI Level (`component: "UI"`)
- Component mount/unmount lifecycle
- Status changes (Idle, Thinking, ExecutingTool, Compacting)
- Input handler registration/deregistration
- Global input events (especially Ctrl+C handling)

#### Input Level (`component: "Input"`)
- All keyboard input events with detailed key information
- Cursor movement and text editing operations
- Command suggestions and autocomplete
- Hotkey activations (Cmd/Ctrl+B, Cmd/Ctrl+D)
- Input handler state changes (active/inactive)

#### Agent Level (`component: "Agent"`)
- Agent initialization and configuration
- Request submissions and processing
- Message streaming from the AI model
- Tool call executions
- Token usage tracking
- Context file/directory additions

#### Reducer Level (`component: "Reducer"`)
- All state changes with before/after values
- Action dispatching and completion times
- Message additions and updates
- Context management operations
- Performance metrics for state operations

### Structured Logging Format

All logs use structured JSON format with consistent fields:

```json
{
  "level": 30,
  "time": 1703123456789,
  "component": "Input",
  "event": "ctrl_c_passthrough",
  "handler": "user_input",
  "action": "not_consuming",
  "msg": "Ctrl+C detected - passing through to global handler"
}
```

### Performance Monitoring

The system includes built-in performance monitoring:
- Agent initialization time
- Request processing duration
- State change operation times
- Stream processing metrics

### Best Practices

1. **Use appropriate log levels** - Don't log sensitive information at info level
2. **Include context** - All logs include relevant component and event information
3. **Structured data** - Use the data parameter for searchable information
4. **Performance awareness** - Trace level logging may impact performance

## Known Issues

### Ctrl+C Exit Issue - RESOLVED ✅

**Problem**: The CLI application did not properly exit when users pressed Ctrl+C, requiring users to force-quit the terminal or use other methods to exit.

**Root Cause**: The `UserInput` component's input handler was consuming Ctrl+C events without properly passing them through to the global handler. The issue was in the modifier key handling logic where `return;` was called for all modifier combinations, preventing event bubbling.

**Solution Implemented**:

1. **Fixed Event Passthrough**: Modified the `UserInput` component to explicitly detect Ctrl+C and NOT consume the event, allowing it to bubble up to the global handler.

2. **Added Comprehensive Logging**: Implemented detailed pino-based logging of all input events, handler registrations, and event processing to make future debugging easier.

3. **Dual Handler Strategy**: Maintained both the global handler (always active) and the UserInput handler (active when not thinking) with proper event coordination.

**Key Code Changes**:

In `UserInput.tsx`:
```typescript
// CRITICAL FIX: Handle Ctrl+C explicitly and DON'T consume it
if (key.ctrl && key.c) {
    inputLogger.info({ 
        event: 'ctrl_c_passthrough',
        handler: 'user_input',
        action: 'not_consuming'
    }, 'Ctrl+C detected - passing through to global handler');
    // Don't return here - let the event bubble up to the global handler
    // This is the key fix - we were consuming the event before
}
```

**Verification**:
- Ctrl+C now works reliably in all application states
- Comprehensive logging shows proper event flow from UserInput to global handler
- Process SIGINT handler also remains as backup

**Debugging the Fix**:
To verify the fix is working, enable debug logging and watch for these log entries:
```bash
WINGMAN_LOG_LEVEL=debug wingman
# Press Ctrl+C and check logs:
tail -f .wingman/debug.log | grep -E "(ctrl_c|sigint)"
```

**Files Modified**:
- `cli/src/components/UserInput.tsx` - Fixed event passthrough with logging
- `cli/src/ui.tsx` - Enhanced global handler with logging
- `cli/src/index.tsx` - Added log level CLI flag and startup logging
- `cli/src/utils/logger.ts` - Comprehensive pino-based logging system
- `cli/src/contexts/WingmanContext.tsx` - Agent interaction logging
- `cli/src/contexts/wingmanReducer.ts` - State change logging

**Prevention**:
- All input handlers now have comprehensive logging
- Event consumption is explicitly logged with structured data
- Handler registration/deregistration is tracked
- Performance metrics help identify bottlenecks
- Easy to identify similar issues in the future with searchable logs