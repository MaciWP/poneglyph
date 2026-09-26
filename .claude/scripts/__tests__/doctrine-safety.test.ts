import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

// Quality review 2026-09-11, findings H16 and H31. A skill is instructions the model
// executes. Two classes of instruction must never appear unconditionally in one, because
// CLAUDE.md gates them on a this-turn user decision: launching agents, and mutating git.
// Checked as a class so the next skill cannot reintroduce it.
const root = resolve(import.meta.dir, "..", "..", "..");
const skillsRoot = join(root, ".claude", "skills");

const GATE = /approval|approve|authori[sz]|permission|ask(ed)? (the user|first|Oriol)|this[- ]turn|gate|consent|CLAUDE\.md/i;
// "You MUST use the Agent tool", "MANDATORY ... Agent tool", "you must spawn".
const SPAWN = /\bMUST use the Agent tool\b|\bMANDATORY[^.\n]{0,40}\bAgent tool\b|\byou must (dispatch|spawn|launch)\b/i;
// A numbered or bulleted STEP that mutates git. Table rows are excluded: they describe
// commits, they do not order one.
const GIT_STEP = /^\s*(?:[-*]|\d+\.)\s*(?:Commit|Create a (?:feature )?branch|Create PR|Open a PR|Squash|Push)\b/i;

function markdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "__tests__") out.push(...markdownFiles(p)); }
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function offenders(re: RegExp): string[] {
  const hits: string[] = [];
  for (const file of markdownFiles(skillsRoot)) {
    const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
    lines.forEach((line, i) => {
      if (!re.test(line)) return;
      // The gate may be named in the surrounding paragraph, not on the same line.
      const near = lines.slice(Math.max(0, i - 6), i + 7).join(" ");
      if (GATE.test(near)) return;
      hits.push(`${relative(root, file).replace(/\\/g, "/")}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  return hits;
}

describe("skills never order a gated action unconditionally", () => {
  it("finds the skill catalog", () => {
    expect(markdownFiles(skillsRoot).length).toBeGreaterThan(50);
  });

  it("H31 — no skill commands an Agent dispatch without naming the approval gate", () => {
    expect(offenders(SPAWN)).toEqual([]);
  });

  it("H16 — no skill lists a git mutation as a plain step without naming authorization", () => {
    expect(offenders(GIT_STEP)).toEqual([]);
  });
});

// Quality review 2026-09-11, finding H15. The extract-conditional example teaches an
// authorization refactor. Its BEFORE denies an unknown role; its AFTER must deny it too,
// or the example hands a reader a privilege escalation as good practice.
describe("the authorization example does not widen access (H15)", () => {
  const file = join(skillsRoot, "code-quality", "references", "quality", "extract-function.md");
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const after = text.split("// AFTER: Extracted with early returns")[1]?.split("```")[0] ?? "";

  it("finds the AFTER block", () => {
    expect(after).toContain("getAccessLevel");
  });

  it("keeps a deny path for a role the BEFORE code denied", () => {
    expect(after).toContain('return "none"');
  });

  it("denies the unknown role before reaching the permissive default", () => {
    // The final `return "read"` is correct: by then the role is known to be "user".
    // What matters is that an unrecognised role is denied EARLIER.
    const deny = after.indexOf('return "none"');
    const permissive = after.lastIndexOf('return "read"');
    expect(deny).toBeGreaterThan(-1);
    expect(deny).toBeLessThan(permissive);
  });
});

// Quality review 2026-09-11, finding H40. `harness-runtime.md` requires quoted paths; the
// generated hook commands interpolate $HOME unquoted, so a home directory with a space
// splits into two arguments and every hook silently stops running.
describe("hook commands quote their interpolated paths (H40)", () => {
  const settings = readFileSync(join(root, ".claude", "settings.global.json"), "utf8");

  it("finds hook commands", () => {
    expect(settings).toContain("$HOME");
  });

  it("never leaves $HOME unquoted in a command", () => {
    const bad = [...settings.matchAll(/"command":\s*"([^"]*\$HOME[^"]*)"/g)]
      .map((m) => m[1])
      .filter((cmd) => !/"\$HOME[^"]*"|'\$HOME[^']*'/.test(cmd.replace(/\\"/g, '"')));
    expect(bad).toEqual([]);
  });
});

// Opus 5.5 playbook, 2026-09-23: "Keep permission prompts on for destructive commands too".
// An explicit ask rule prompts in every mode, auto and bypassPermissions included; the
// doctrine alone does not. Allow rules never cancel it, so the broad "Bash" allow is safe.
// 2026-09-26, Oriol: git no longer prompts. Local git runs freely; remote git is gated by the
// remote-git-gate hook, which lets it through when he asked this turn. An ask rule would
// prompt even then, so no git or gh command may sit in `ask`.
describe("recursive deletes always prompt; git is gated only on the remote", () => {
  const settings = JSON.parse(readFileSync(join(root, ".claude", "settings.global.json"), "utf8"));
  const ask: string[] = settings.permissions.ask;
  // The documented prefix contract (code.claude.com/docs/en/permissions): "Tool(x *)" matches
  // "x" and "x ..."; a rule without a trailing " *" matches the exact command only.
  const prompts = (shell: string, cmd: string) =>
    ask.some((rule) => {
      const m = rule.match(/^(\w+)\((.*)\)$/);
      if (!m || m[1] !== shell) return false;
      const prefix = m[2].endsWith(" *") ? m[2].slice(0, -2) : null;
      return prefix === null ? cmd === m[2] : cmd === prefix || cmd.startsWith(`${prefix} `);
    });
  const GIT = ["git reset --hard", "git reset --hard HEAD~1", "git clean -fd", "git branch -D x", "git stash drop", "git stash clear", "git worktree remove w", "git checkout -- f", "git checkout .", "git restore f", "git merge b", "git rebase main", "git push", "git push origin b", "gh pr create", "gh pr merge 39"];

  it.each(["rm -r d", "rm -rf d", "rm -fr d", "rm -R d", "rm -Rf d", "rm -fR d", "rm -rfv d", "rm --recursive d"])("asks before %s in Bash", (cmd) => {
    expect(prompts("Bash", cmd)).toBe(true);
  });

  it("asks before a delete in PowerShell", () => {
    expect(prompts("PowerShell", "Remove-Item -Recurse d")).toBe(true);
  });

  it.each(GIT)("never prompts for %s in either shell", (cmd) => {
    for (const shell of ["Bash", "PowerShell"]) expect(prompts(shell, cmd)).toBe(false);
  });

  it("registers the remote gate for every tool that runs a command", () => {
    const entry = settings.hooks.PreToolUse.find((e: { hooks: Array<{ command: string }> }) =>
      e.hooks.some((h) => h.command.includes("remote-git-gate.ts")),
    );
    expect(entry?.matcher.split("|").sort()).toEqual(["Bash", "Monitor", "PowerShell"]);
    // A hook that times out does not block, so the timeout must leave room for the gate's own
    // 10 s deadline, which fails closed.
    const hook = entry?.hooks.find((h: { command: string }) => h.command.includes("remote-git-gate.ts"));
    expect(hook?.timeout).toBeGreaterThan(10);
  });
});

// Quality review 2026-09-11, finding H23. The complexity score is the sum of five factors,
// each contributing at least ~6.7 points, so the floor is ~33. Two routing rows sat below
// that floor and could never fire: the table promised a decision it could not reach.
describe("every complexity routing band is reachable (H23)", () => {
  const file = join(root, ".claude", "skills", "agent-routing", "references", "03-complexity-routing.md");
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const FACTORS = 5;
  const MIN = Number((FACTORS * (1 * 0.2 * (100 / 3))).toFixed(1)); // every factor Low
  const MAX = Number((FACTORS * (3 * 0.2 * (100 / 3))).toFixed(1)); // every factor High

  function bands(): { label: string; lo: number; hi: number }[] {
    const section = text.split("## Routing by Complexity")[1]?.split("\n## ")[0] ?? "";
    const out: { label: string; lo: number; hi: number }[] = [];
    for (const line of section.split("\n")) {
      const m = /^\|\s*\*\*([^*]+)\*\*\s*\|/.exec(line);
      if (!m) continue;
      const label = m[1].trim();
      let lo = -Infinity, hi = Infinity;
      const range = /^(?:≤\s*)?(\d+)\s*-\s*(\d+)$/.exec(label);
      if (range) { lo = Number(range[1]); hi = Number(range[2]); }
      else if (/^[<≤]\s*(\d+)$/.test(label)) hi = Number(/(\d+)/.exec(label)![1]);
      else if (/^[>≥]\s*(\d+)$/.test(label)) lo = Number(/(\d+)/.exec(label)![1]);
      out.push({ label, lo, hi });
    }
    return out;
  }

  it("reads the routing table", () => {
    expect(bands().length).toBeGreaterThanOrEqual(3);
  });

  it("states a floor no lower than the formula allows", () => {
    expect(MIN).toBeCloseTo(33.3, 1);
    expect(MAX).toBeCloseTo(100, 1);
  });

  it("has no band that the formula can never produce", () => {
    const unreachable = bands().filter((b) => b.hi < MIN || b.lo > MAX).map((b) => b.label);
    expect(unreachable).toEqual([]);
  });
});

// Quality review 2026-09-11, finding H45. Three files gave three cyclomatic thresholds
// (> 10, > 15, > 20). `complexity-metrics.md` owns the scale: 1-5 simple, 6-10 moderate,
// 11-20 complex (refactor), > 20 very complex (split). Every other table must cite it.
describe("one cyclomatic scale across code-quality (H45)", () => {
  const dir = join(skillsRoot, "code-quality");
  const CANON = new Set([5, 6, 10, 11, 20]);

  function thresholds(): string[] {
    const out: string[] = [];
    for (const f of markdownFiles(dir)) {
      const lines = readFileSync(f, "utf8").replace(/\r\n/g, "\n").split("\n");
      lines.forEach((l, i) => {
        if (!/cyclomatic/i.test(l)) return;
        for (const m of l.matchAll(/[><]\s*(\d+)/g)) {
          if (!CANON.has(Number(m[1]))) out.push(`${relative(root, f).split(sep).join("/")}:${i + 1} -> ${m[0]}`);
        }
      });
    }
    return out;
  }

  it("finds the cyclomatic tables", () => {
    expect(markdownFiles(dir).length).toBeGreaterThan(3);
  });

  it("uses no threshold outside the owned scale", () => {
    expect(thresholds()).toEqual([]);
  });
});
