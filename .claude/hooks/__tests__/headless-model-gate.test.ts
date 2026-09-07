import { describe, expect, it } from "bun:test";
import { buildDenial, judgeCommand } from "../headless-model-gate";

describe("headless-model-gate — judgeCommand (plan 033)", () => {
  const allowed = [
    "git status",
    "claude doctor",
    "claude plugin validate .claude",
    "claude plugin details poneglyph-work@poneglyph-work",
    'claude -p --model claude-haiku-4-5-20251001 "Reply READY"',
    'claude -p "x" --output-format text --model=claude-sonnet-5',
    'claude --print --model claude-sonnet-5 "x"',
    "bun .claude/evals/run.ts", // the script picks its own cheap default
    "bun .claude/evals/run.ts --model claude-sonnet-5",
    'claude -p --model claude-fable-5-1 --allow-expensive "x"',
    "bun .claude/evals/probe-activation.ts after --model claude-fable-5-1 --allow-expensive",
    'echo "claude -p is documented here" > notes.md', // mentions claude but does not run it headless… wait: it contains -p? no — echo is the command',
  ];
  for (const cmd of allowed) {
    it(`allows: ${cmd}`, () => {
      expect(judgeCommand(cmd)).toEqual({ allow: true });
    });
  }

  const denied: Array<[string, RegExp]> = [
    ['claude -p "hola"', /without --model/],
    ['claude --print "hola" --output-format json', /without --model/],
    ['claude -p --model claude-fable-5-1 "x"', /--allow-expensive/],
    ['claude -p --model opus "x"', /--allow-expensive/],
    ['claude -p --model claude-sonnet-5 --fallback-model claude-opus-5 "x"', /--allow-expensive/],
    ["bun .claude/evals/run.ts --model claude-fable-5-1", /never the default/],
    ["bun .claude/evals/compare.ts x --model=claude-opus-5", /never the default/],
    ["cd scratch && bun probe-activation.ts after claude-fable-5-1 --model claude-fable-5-1", /never the default/],
    ['C:\\Users\\Oriol\\.local\\bin\\claude.exe -p "x"', /without --model/],
  ];
  for (const [cmd, re] of denied) {
    it(`denies: ${cmd}`, () => {
      const v = judgeCommand(cmd);
      expect(v.allow).toBe(false);
      expect((v as { reason: string }).reason).toMatch(re);
    });
  }

  it("emits the PreToolUse deny shape", () => {
    const out = JSON.parse(buildDenial("why"));
    expect(out.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(out.hookSpecificOutput.permissionDecisionReason).toBe("why");
  });
});
