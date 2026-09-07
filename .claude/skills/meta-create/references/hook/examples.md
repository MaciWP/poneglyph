---
parent: meta-create
name: examples
description: Three worked hook examples (format-on-edit PostToolUse, block-dangerous PreToolUse, log-api-errors StopFailure).
---

# Worked Hook Examples

## Contents

- [Example 1: Format Code on Edit](#example-1-format-code-on-edit)
- [Example 2: Block Dangerous Commands](#example-2-block-dangerous-commands)
- [Example 3: Log API Errors](#example-3-log-api-errors)

Three complete end-to-end hooks showing the script + settings.json registration.

## Example 1: Format Code on Edit

**PostToolUse** / command / async

```
/meta-create hook format-on-edit PostToolUse
```

**Creates**: `.claude/hooks/format-on-edit.ts`

```typescript
#!/usr/bin/env bun
// format-on-edit - Auto-format TypeScript files after Edit/Write
// Event: PostToolUse | Async: true | Blocking: No

import { execSync } from "node:child_process";

interface HookInput {
  tool_name?: string;
  tool_input?: { file_path?: string };
}

async function main(): Promise<void> {
  const input: HookInput = JSON.parse(await Bun.stdin.text() || "{}");
  const tool = input.tool_name ?? "";
  const filePath = input.tool_input?.file_path ?? "";

  if (!["Edit", "Write"].includes(tool)) process.exit(0);
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) process.exit(0);

  try {
    execSync(`bunx biome format --write "${filePath}"`, {
      timeout: 10_000,
      stdio: "ignore",
    });
  } catch {
    // Best-effort: formatting failure should never block
  }
}

main().catch(() => process.exit(0));
```

**settings.json entry**:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "if": "Edit(*.ts)|Edit(*.tsx)|Write(*.ts)|Write(*.tsx)",
        "hooks": [
          {
            "type": "command",
            "command": "bun run $HOME/.claude/hooks/format-on-edit.ts",
            "timeout": 15,
            "async": true
          }
        ]
      }
    ]
  }
}
```

## Example 2: Block Dangerous Commands

**PreToolUse** / command / blocking

```
/meta-create hook block-dangerous PreToolUse
```

**Creates**: `.claude/hooks/block-dangerous.ts`

```typescript
#!/usr/bin/env bun
// block-dangerous - Blocks destructive shell commands
// Event: PreToolUse | Blocking: Yes (exit 2 to block)

interface HookInput {
  tool_name?: string;
  tool_input?: { command?: string };
}

const BLOCKED_PATTERNS: RegExp[] = [
  /rm\s+(-rf?|--recursive)\s+\/(?!\S)/,  // rm -rf /
  /git\s+push\s+--force\s+(origin\s+)?(main|master)/,  // force push to main
  /git\s+reset\s+--hard\s+HEAD~?\d*/,  // destructive reset
  /DROP\s+(TABLE|DATABASE)/i,  // SQL drops
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,  // fork bomb
];

function main(): void {
  const raw = require("fs").readFileSync("/dev/stdin", "utf-8");
  const input: HookInput = JSON.parse(raw || "{}");

  if (input.tool_name !== "Bash") process.exit(0);

  const command = input.tool_input?.command ?? "";

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      console.error(`Blocked dangerous command: ${command.slice(0, 80)}`);
      process.exit(2);
    }
  }

  process.exit(0);
}

main();
```

**settings.json entry**:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bun run $HOME/.claude/hooks/block-dangerous.ts",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

## Example 3: Log API Errors

**StopFailure** / command / async

```
/meta-create hook log-api-errors StopFailure
```

**Creates**: `.claude/hooks/log-api-errors.ts`

```typescript
#!/usr/bin/env bun
// log-api-errors - Records API errors to JSONL for analysis
// Event: StopFailure | Async: true | Blocking: No

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface HookInput {
  session_id?: string;
  error?: string | { message: string };
  transcript_path?: string;
}

async function main(): Promise<void> {
  const input: HookInput = JSON.parse(await Bun.stdin.text() || "{}");

  const errorMsg =
    typeof input.error === "string"
      ? input.error
      : input.error?.message ?? "unknown";

  const logDir = join(homedir(), ".claude", "error-logs");
  mkdirSync(logDir, { recursive: true });

  const entry = {
    ts: new Date().toISOString(),
    sessionId: input.session_id ?? null,
    error: errorMsg,
    transcriptPath: input.transcript_path ?? null,
  };

  const logFile = join(logDir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  appendFileSync(logFile, JSON.stringify(entry) + "\n");
}

main().catch(() => process.exit(0));
```

**settings.json entry**:
```json
{
  "hooks": {
    "StopFailure": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun run $HOME/.claude/hooks/log-api-errors.ts",
            "timeout": 10,
            "async": true
          }
        ]
      }
    ]
  }
}
```
