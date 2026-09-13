import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parse as parseToml } from "smol-toml";

// Quality review 2026-09-11, findings H57, H62, H68 and H70. Four defects in the
// always-loaded catalog and in the harness-config packs. Each assertion below locks the
// corrected behaviour so the next edit cannot reintroduce the defect.
const root = resolve(import.meta.dir, "..", "..", "..");
const claude = join(root, ".claude");
const metaHarness = join(claude, "skills", "harness-config");

function read(...parts: string[]): string {
  return readFileSync(join(...parts), "utf8").replace(/\r\n/g, "\n");
}

function markdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...markdownFiles(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

// A markdown inline-code span that assigns the Codex statusline key, e.g. `tui.status_line = null`.
function statusLineAssignments(text: string): string[] {
  return [...text.matchAll(/`([^`\n]*tui\.status_line\s*=[^`\n]*)`/g)].map((m) => m[1].trim());
}

describe("H70 — the T14 pack only shows TOML that a TOML parser accepts", () => {
  const pack = read(metaHarness, "references", "t14-statusline.md");

  it("shows at least one Codex statusline assignment", () => {
    expect(statusLineAssignments(pack).length).toBeGreaterThan(0);
  });

  // `codex doctor` with CODEX_HOME holding `tui.status_line = null` reports
  // "config could not be loaded" (Codex CLI 0.153.4, 2026-09-11): TOML has no null literal,
  // so the reference table's `null` is type notation, not a value a user can write.
  it("every shown assignment parses as TOML", () => {
    for (const assignment of statusLineAssignments(pack)) {
      expect(() => parseToml(assignment)).not.toThrow();
    }
  });

  it("never prescribes a bare null as the disable value", () => {
    expect(/status_line\s*=\s*null/.test(pack)).toBe(false);
  });
});

describe("H62 — the harness-config lifecycle contract has one source", () => {
  const files = markdownFiles(metaHarness).map((f) => ({ path: f, text: read(f) }));
  const carrying = (needle: string) =>
    files.filter((f) => f.text.includes(needle)).map((f) => relative(root, f.path).replace(/\\/g, "/"));

  it("states the five-verb table once", () => {
    expect(carrying("| Consult |")).toEqual([".claude/skills/harness-config/SKILL.md"]);
  });

  it("states the impact step once", () => {
    expect(carrying("before modify / disable / delete / rename")).toEqual([
      ".claude/skills/harness-config/SKILL.md",
    ]);
  });

  // The drift the review caught: lifecycle.md carried the precise wordings while SKILL.md
  // carried vaguer ones. The surviving table keeps the precise pair.
  it("keeps the precise wording of the two rows that had drifted", () => {
    const skill = read(metaHarness, "SKILL.md");
    expect(skill).toContain("Skip `bun run check:config`");
    expect(skill).toContain("Remove source + leftover name registries");
  });
});

describe("H68 — one destination for a stack-specific lesson", () => {
  it("retro does not route a stack lesson into the core lessons skill", () => {
    expect(read(claude, "skills", "flow-retro", "SKILL.md")).not.toContain("lessons/references/");
  });

  it("retro names the private addon that lessons defines", () => {
    expect(read(claude, "skills", "flow-retro", "SKILL.md")).toContain("private addon");
  });
});

// H57 guard (green from the start, not a red test): `disable-model-invocation: true` sets
// "Claude can invoke: No" (code.claude.com/docs/en/skills, read 2026-09-11). A skill that
// always-loaded law orders the model to invoke must therefore stay listed, or the law
// becomes a dead reference. This is why the H57 demotion lever is exhausted on this tree.
describe("H57 — no skill named by always-loaded law is hidden from the model", () => {
  const law = [join(root, "CLAUDE.md"), ...markdownFiles(join(claude, "rules"))]
    .map((f) => read(f))
    .join("\n");

  const demoted = readdirSync(join(claude, "skills")).filter((s) => {
    let text: string;
    try {
      text = read(claude, "skills", s, "SKILL.md");
    } catch {
      return false;
    }
    return /^disable-model-invocation:\s*true\s*$/m.test(text.split(/^---\s*$/m)[1] ?? "");
  });

  it("finds the demoted skills", () => {
    expect(demoted.length).toBeGreaterThan(0);
  });

  it("none of them is named as a model-invoked step in CLAUDE.md or .claude/rules/", () => {
    expect(demoted.filter((s) => new RegExp(`\`${s}\``).test(law))).toEqual([]);
  });
});
