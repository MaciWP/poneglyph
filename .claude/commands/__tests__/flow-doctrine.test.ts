import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { frontmatterField } from "../../scripts/lib/budget";

// Quality review 2026-09-10, finding H51. Two facts about /flow-lifecycle lived in several files
// and drifted: how many phases the pipeline has, and whether `allowed-tools` exempts a
// phase from CLAUDE.md's spawn gate. The enumeration in flow-lifecycle.md owns the first fact, and
// nothing the model pays for on every turn may restate it. The frontmatter is the trigger
// for the second. Both are derived here, so the checks survive a reworded sentence and a
// renumbered pipeline.
const root = resolve(import.meta.dir, "..", "..", "..");
// These files are CRLF on this machine; normalize so the anchors below mean what they say.
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8").replace(/\r\n/g, "\n");
const flow = read(".claude", "commands", "flow-lifecycle.md");

/** The numbered list of phase skills is the single owner of the phase count. */
const enumerated = [...flow.matchAll(/^\d+\. \*\*/gm)].length;

const WORD: Record<string, number> = { five: 5, six: 6, cinco: 5, seis: 6 };
/** In flow-lifecycle.md the count is also spelled as a step heading; there it is the owner. */
const CLAIM_OWNER = /\b(\d+|five|six|cinco|seis)[- ](phases?|fases?|steps?)\b/gi;
/** Everywhere else only a phase count is a second owner of this fact. */
const CLAIM_SURFACE = /\b(\d+|five|six|cinco|seis)[- ](phases?|fases?)\b/gi;

function claims(source: string, id: string, pattern: RegExp) {
  return source.split("\n").flatMap((line, i) =>
    [...line.matchAll(pattern)].map(m => ({
      where: `${id}:${i + 1}`,
      text: m[0],
      count: WORD[m[1].toLowerCase()] ?? Number(m[1]),
    })),
  );
}

/**
 * Every text the model pays for on every turn: CLAUDE.md, the global rules, and each
 * skill's description + when_to_use — the same surface `budget.ts` measures. A skill with
 * `disable-model-invocation: true` never reaches the listing, so it costs nothing here.
 */
function alwaysLoaded(): Array<[string, string]> {
  const texts: Array<[string, string]> = [["CLAUDE.md", read("CLAUDE.md")]];
  for (const f of readdirSync(join(root, ".claude", "rules"))) {
    if (f.endsWith(".md")) texts.push([`rules/${f}`, read(".claude", "rules", f)]);
  }
  const skillsDir = join(root, ".claude", "skills");
  for (const skill of readdirSync(skillsDir)) {
    if (!existsSync(join(skillsDir, skill, "SKILL.md"))) continue;
    const text = read(".claude", "skills", skill, "SKILL.md");
    if (/^disable-model-invocation:\s*true\s*$/m.test(text.split(/^---\s*$/m)[1] ?? "")) continue;
    const surface = `${frontmatterField(text, "description")}\n${frontmatterField(text, "when_to_use")}`;
    texts.push([`skills/${skill} frontmatter`, surface]);
  }
  return texts;
}

describe("flow doctrine — one owner per fact", () => {
  test("flow-lifecycle.md still enumerates its phase skills", () => {
    expect(enumerated).toBeGreaterThan(0);
  });

  test("flow-lifecycle.md's own count claims match its enumeration", () => {
    const wrong = claims(flow, "flow-lifecycle.md", CLAIM_OWNER)
      .filter(c => c.count !== enumerated)
      .map(c => `${c.where} says "${c.text}" but the list enumerates ${enumerated}`);
    expect(wrong).toEqual([]);
  });

  test("no always-loaded text restates the phase count", () => {
    const restated = alwaysLoaded()
      .flatMap(([id, text]) => claims(text, id, CLAIM_SURFACE))
      .map(c => `${c.where} restates the phase count as "${c.text}"; flow-lifecycle.md owns it`);
    expect(restated).toEqual([]);
  });

  test("pre-authorizing Agent does not silently waive the per-task spawn gate", () => {
    const frontmatter = flow.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    // A frontmatter that fails to parse would make this whole check pass on nothing.
    expect(frontmatter, "flow-lifecycle.md frontmatter did not parse").not.toBe("");
    const preauthorized = /^allowed-tools:.*\bAgent\b/m.test(frontmatter);
    if (!preauthorized) return; // nothing to waive, nothing to state
    const body = flow.slice(flow.indexOf("\n---", 3) + 4);
    const states = body
      .split(/(?<=[.:])\s/)
      .some(s => /allowed-tools/i.test(s) && /\bspawn|pre-?authori[sz]|approval\b/i.test(s));
    expect(states).toBe(true);
  });
});
