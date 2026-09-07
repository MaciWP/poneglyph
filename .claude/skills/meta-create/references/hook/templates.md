---
parent: meta-create
name: templates
description: Six hook templates — command (observability/validator/transform), http, prompt, agent.
---

# Hook Templates

## Contents

- [Template: Command Hook (Observability)](#template-command-hook-observability)
- [Template: Command Hook (Validator)](#template-command-hook-validator)
- [Template: Command Hook (Transform)](#template-command-hook-transform)
- [Template: HTTP Hook](#template-http-hook)
- [Template: Prompt Hook](#template-prompt-hook)
- [Template: Agent Hook](#template-agent-hook)

Six canonical templates. Three command-hook shapes (observability, validator, transform) and one each for http, prompt and agent handlers.

## Template: Command Hook (Observability)

For async, non-blocking hooks (telemetry, metrics):

```typescript
#!/usr/bin/env bun
// {hook-name} - {description}
// Event: {event} | Async: true | Blocking: No

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  last_assistant_message?: string;
  transcript?: Array<{ role: string; content: unknown }>;
  stop_hook_active?: boolean;
}

async function main(): Promise<void> {
  const raw = await Bun.stdin.text();
  const input: HookInput = JSON.parse(raw || "{}");

  // GUARD: prevent infinite loops in Stop/SubagentStop hooks
  // Uncomment if this hook is for Stop or SubagentStop event:
  // if (input.stop_hook_active) process.exit(0);

  // --- Hook logic starts here ---

  const logDir = join(homedir(), ".claude", "logs");
  mkdirSync(logDir, { recursive: true });

  const entry = {
    ts: new Date().toISOString(),
    sessionId: input.session_id ?? null,
    // Add your fields here
  };

  const logFile = join(logDir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  appendFileSync(logFile, JSON.stringify(entry) + "\n");
}

main().catch(() => process.exit(0)); // Best-effort: never block Claude
```

## Template: Command Hook (Validator)

For blocking hooks that enforce rules (PreToolUse, PermissionRequest):

```typescript
#!/usr/bin/env bun
// {hook-name} - {description}
// Event: {event} | Blocking: Yes (exit 2 to block)

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

function main(): void {
  const raw = require("fs").readFileSync("/dev/stdin", "utf-8");
  const input: HookInput = JSON.parse(raw || "{}");

  const toolName = input.tool_name ?? "";
  const toolInput = input.tool_input ?? {};

  // --- Validation logic starts here ---
  const isValid = true; // Replace with actual check

  if (!isValid) {
    // stderr message is shown to the user as a warning
    console.error("Blocked: {reason}");
    process.exit(2); // Block the tool call
  }

  // Optional: return JSON to modify behavior or add context
  // console.log(JSON.stringify({
  //   hookSpecificOutput: { additionalContext: "..." }
  // }));

  process.exit(0);
}

main();
```

## Template: Command Hook (Transform)

For hooks that modify tool input/output (PostToolUse formatters, UserPromptSubmit enrichers):

```typescript
#!/usr/bin/env bun
// {hook-name} - {description}
// Event: {event} | Blocking: No | Transforms output

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
}

async function main(): Promise<void> {
  const raw = await Bun.stdin.text();
  const input: HookInput = JSON.parse(raw || "{}");

  // --- Transform logic starts here ---

  // Return JSON on stdout to pass data back to Claude
  const output = {
    hookSpecificOutput: {
      // Fields here are merged into the hook result
      additionalContext: "Transformed by {hook-name}",
    },
  };

  console.log(JSON.stringify(output));
  process.exit(0);
}

main().catch(() => process.exit(0));
```

## Template: HTTP Hook

For external webhook integrations:

```json
{
  "type": "http",
  "url": "https://your-api.example.com/webhook/{event}",
  "headers": {
    "Authorization": "Bearer ${API_KEY}",
    "Content-Type": "application/json"
  },
  "allowedEnvVars": ["API_KEY"],
  "timeout": 30
}
```

## Template: Prompt Hook

For LLM-evaluated policy decisions:

```json
{
  "type": "prompt",
  "prompt": "Review the following tool call and decide if it should proceed. If it should NOT proceed, respond with BLOCK and a reason. If it should proceed, respond with ALLOW.\n\nTool: $ARGUMENTS",
  "model": "haiku",
  "timeout": 30
}
```

## Template: Agent Hook

For autonomous sub-agent decisions on events:

```json
{
  "type": "agent",
  "prompt": "Analyze the following event and take appropriate action: $ARGUMENTS",
  "model": "sonnet",
  "timeout": 60
}
```
