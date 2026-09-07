#!/usr/bin/env bun

// PreToolUse (Bash) — the belt against paying Fable/Opus for a headless run (plan 033, D2).
//
// 2026-09-03: the Lead launched 82 `claude -p` sessions in one day, 44 on Opus (no --model,
// host default) and 29 on Fable (explicit). CLAUDE.md §Agent spawn already says a headless
// run is a separate model worker; this hook makes the rule mechanical for the one surface
// where it slipped: a Bash command typed by the Lead. Denies when the command
//   (a) runs `claude -p` / `claude --print` without `--model`,
//   (b) names a Fable/Opus model (`--model` or `--fallback-model`) without `--allow-expensive`,
//   (c) runs a repo headless script (evals/run.ts, compare.ts, probe-activation.ts) with an
//       expensive `--model` and no `--allow-expensive`.
// Everything else is silent (exit 0, no output). PreToolUse is best-effort (#6305): the
// braces are `scripts/lib/headless.ts`, which gives every script a cheap default on its own.
import { readHookStdin } from "./lib/hook-stdin";
import { EXPENSIVE_MODEL_RE } from "./lib/headless-models";

export type Judgement = { allow: true } | { allow: false; reason: string };

const HEADLESS_SCRIPT_RE = /(evals\/run\.ts|evals\/compare\.ts|probe-activation\.ts)/;

// Splits a shell command into tokens well enough to find flags (quotes kept simple on
// purpose: flags never carry spaces).
function tokens(cmd: string): string[] {
  return cmd.split(/\s+/).filter(Boolean);
}

function flagValue(toks: string[], flag: string): string | undefined {
  const i = toks.indexOf(flag);
  if (i >= 0) return toks[i + 1];
  const eq = toks.find((t) => t.startsWith(`${flag}=`));
  return eq ? eq.slice(flag.length + 1) : undefined;
}

// Pure. One shell command in, a verdict out.
export function judgeCommand(cmd: string): Judgement {
  if (!/\bclaude\b|probe-activation|evals\/(run|compare)\.ts/.test(cmd)) return { allow: true };
  const toks = tokens(cmd);
  const allowExpensive = toks.includes("--allow-expensive");

  // (c) repo headless scripts
  if (HEADLESS_SCRIPT_RE.test(cmd)) {
    const model = flagValue(toks, "--model");
    if (model && EXPENSIVE_MODEL_RE.test(model) && !allowExpensive) {
      return { allow: false, reason: `Headless script on "${model}" without --allow-expensive. Fable/Opus are never the default for evals or probes (CLAUDE.md §Agent spawn, plan 033). Drop --model to get the cheap tier, or add --allow-expensive with Oriol's this-turn permission.` };
    }
    return { allow: true };
  }

  // (a)/(b) raw claude CLI — only when `claude` is the COMMAND word (start of the line or
  // right after a shell operator), so `echo "claude -p …"` or a grep for it stays allowed.
  const OPERATORS = new Set(["&&", "||", ";", "|", "(", "{", "then", "do", "else", "exec", "time", "nohup"]);
  const claudeIdx = toks.findIndex((t, i) => /(^|[\\/])claude(\.exe)?$/.test(t) && (i === 0 || OPERATORS.has(toks[i - 1]) || /[;&|]$/.test(toks[i - 1])));
  if (claudeIdx === -1) return { allow: true };
  const rest = toks.slice(claudeIdx + 1);
  const headless = rest.includes("-p") || rest.includes("--print");
  if (!headless) return { allow: true }; // `claude doctor`, `claude plugin …`, interactive
  const model = flagValue(rest, "--model");
  if (!model) {
    return { allow: false, reason: "Headless `claude -p` without --model inherits the host default (Opus/Fable — 82 sessions on 2026-09-03). Name a cheap tier: --model claude-haiku-4-5-20251001 (prose/smoke) or --model claude-sonnet-5 (skill triggers). Plan 033." };
  }
  const fallback = flagValue(rest, "--fallback-model") ?? "";
  if ((EXPENSIVE_MODEL_RE.test(model) || EXPENSIVE_MODEL_RE.test(fallback)) && !allowExpensive) {
    return { allow: false, reason: `Headless \`claude -p\` on "${model}" costs several times the cheap tiers. Use claude-haiku-4-5-20251001 / claude-sonnet-5, or add --allow-expensive together with Oriol's this-turn permission (CLAUDE.md §Agent spawn).` };
  }
  return { allow: true };
}

export function buildDenial(reason: string): string {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
  });
}

if (import.meta.main) {
  try {
    const raw = await readHookStdin();
    const payload = JSON.parse(raw) as { tool_name?: string; tool_input?: { command?: unknown } };
    if (payload.tool_name === "Bash" && typeof payload.tool_input?.command === "string") {
      const verdict = judgeCommand(payload.tool_input.command);
      if (!verdict.allow) process.stdout.write(buildDenial(verdict.reason) + "\n");
    }
  } catch {
    // best-effort — a broken payload never blocks a command
  }
  process.exit(0);
}
