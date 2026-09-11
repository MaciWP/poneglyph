import { describe, expect, it } from "bun:test";
import { basename } from "node:path";
import { BIG_FILE_BYTES, buildOutput, shapeCommand } from "../bash-output-shaper";

// Sizes by basename so the fixture is path-separator agnostic (Windows suite, audit 010).
const sizes: Record<string, number> = { "plan.md": 28_000, "README.md": 5_000, "big.log": BIG_FILE_BYTES + 1, "small.txt": 10 };
const fileSize = (p: string) => sizes[basename(p)] ?? null;
const shape = (cmd: string) => shapeCommand(cmd, "/repo", fileSize);

describe("bash-output-shaper — shapeCommand (plan 037, WP3)", () => {
  const allowed = [
    "git status",
    "git diff",
    "git diff -- .claude/settings.global.json",
    "bun test ./.claude/",
    "cat README.md",
    "cat small.txt README.md",
    "cat plan.md | head -n 50",
    "sed -n '1,40p' README.md",
    "sed -n 's/a/b/p' plan.md | grep x",
    "cat plan.md # raw",
    "cat > out.txt <<'EOF'\nhello\nEOF",
    "echo hi > plan.md",
    "cat plan.md > out.md", // stdout redirected to a file: a write, not a dump
    "cat plan.md 1>out.md",
    "cat plan.md >> out.md",
    "cat missing-file.md",
    "ls -la",
    "git log --oneline -n 5",
    "git log -n 3 -- src",
    "git log --since=2.weeks --stat",
    "find . -name '*.ts' | wc -l",
    "grep -rn ponytail .claude | head",
  ];
  for (const cmd of allowed) {
    it(`allows: ${cmd.replace(/\n/g, "\\n")}`, () => {
      expect(shape(cmd)).toEqual({ action: "allow" });
    });
  }

  const denied = [
    "cat plan.md",
    'cat ".claude/plans/032/plan.md"',
    "cd \"/repo/sub\" && cat plan.md",
    "sed -n '1,400p' plan.md",
    "echo '=== a ===' && cat README.md && cat plan.md",
    "cat big.log",
    "cat plan.md 2>/dev/null", // only stderr is redirected — the dump still reaches the context
    "cat plan.md 2>&1",
  ];
  for (const cmd of denied) {
    it(`denies: ${cmd}`, () => {
      const v = shape(cmd);
      expect(v.action).toBe("deny");
      expect((v as { reason: string }).reason).toMatch(/Read with offset\/limit|Grep/);
      expect((v as { reason: string }).reason).toMatch(/# raw/);
    });
  }

  const rewritten: Array<[string, string]> = [
    ["git log", "git log --oneline -n 30"],
    ["git log -- src/app.ts", "git log --oneline -n 30 -- src/app.ts"],
    ["git log origin/main..HEAD", "git log origin/main..HEAD --oneline -n 30"],
    ["ls -R", "ls -R | head -n 200"],
    ["ls -laR .claude", "ls -laR .claude | head -n 200"],
    ["find . -name '*.ts'", "find . -name '*.ts' | head -n 200"],
    ["tree .claude", "tree .claude | head -n 200"],
    ["git status && find . -name x", "git status && find . -name x | head -n 200"],
    ["cd /repo && git log; echo done", "cd /repo && git log --oneline -n 30; echo done"],
  ];
  for (const [cmd, expected] of rewritten) {
    it(`rewrites: ${cmd}`, () => {
      expect(shape(cmd)).toEqual({ action: "rewrite", command: expected });
    });
  }

  it("a deny anywhere in the line wins over rewrites elsewhere", () => {
    expect(shape("git log && cat plan.md").action).toBe("deny");
  });
});

describe("bash-output-shaper — hook output shapes", () => {
  it("is silent on allow", () => {
    expect(buildOutput({ action: "allow" }, { command: "git status" })).toBeNull();
  });
  it("emits the PreToolUse deny shape", () => {
    const out = JSON.parse(buildOutput({ action: "deny", reason: "why" }, { command: "cat plan.md" })!);
    expect(out.hookSpecificOutput).toEqual({ hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "why" });
  });
  it("emits updatedInput with every other tool_input field preserved", () => {
    const out = JSON.parse(buildOutput({ action: "rewrite", command: "git log --oneline -n 30" }, { command: "git log", description: "d", timeout: 5 })!);
    expect(out.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(out.hookSpecificOutput.permissionDecision).toBe("allow");
    expect(out.hookSpecificOutput.updatedInput).toEqual({ command: "git log --oneline -n 30", description: "d", timeout: 5 });
  });
});

// Quality review 2026-09-11 — H22: the command is split on newlines BEFORE the heredoc
// check, so a heredoc BODY line is shaped as if it were a command. Heredocs are writes:
// the shaper must never touch them.
describe("heredoc bodies are data, not commands (H22)", () => {
  it("allows a heredoc whose body line starts with cat", () => {
    expect(shape("cat > notes.md <<'EOF'\ncat plan.md\nEOF").action).toBe("allow");
  });

  it("allows a heredoc whose body line starts with a bare find", () => {
    expect(shape("cat > notes.md <<'EOF'\nfind . -name '*.ts'\nEOF").action).toBe("allow");
  });

  it("still denies a real unbounded cat on a big file", () => {
    expect(shape("cat plan.md").action).toBe("deny");
  });
});
