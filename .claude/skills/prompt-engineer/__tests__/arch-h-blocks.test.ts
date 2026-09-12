import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Quality review 2026-09-11, H44. prompt-engineer's Context 3 told the reviewer to
// verify [TASK] [CONTEXT] [CONSTRAINTS] [DELIVERABLE] -- three names the live Arch H
// template does not use -- while omitting the three it does ([ACCUMULATED MEMORY],
// [QUALITY STANCE], [MEMORY OUTPUT]). A prompt scored against a template that no
// longer exists passes the check and still ships an incomplete delegation.
//
// The root cause was a second copy of the block list, free to drift. The fix removes
// the copy and cites the template. These tests lock both halves: the citation must
// resolve, and no re-added name may contradict the template.
const root = resolve(import.meta.dir, "..", "..", "..", "..");
const TEMPLATE_REL = ".claude/skills/orchestrator-protocol/references/06-context-arch-h.md";
const template = readFileSync(resolve(root, TEMPLATE_REL), "utf8");
const skill = readFileSync(resolve(root, ".claude/skills/prompt-engineer/SKILL.md"), "utf8");

// The checklist line that tells a reviewer what to verify before delegating.
function checklistLine(): string {
  const line = skill.split("\n").find((l) => /^1\. Verify .*Arch H/.test(l));
  if (!line) throw new Error("no Arch H checklist line in prompt-engineer/SKILL.md");
  return line;
}

// Block names as the template writes them, minus the "- {agent}" qualifier.
function templateBlocks(): string[] {
  const fence = template.match(/## Arch H Delegation Template[\s\S]*?```\r?\n([\s\S]*?)```/);
  if (!fence) throw new Error("Arch H template fence not found in 06-context-arch-h.md");
  return [...fence[1].matchAll(/^\[([^\]]+)\]\r?$/gm)].map((m) => m[1].split(" - ")[0].trim());
}

describe("prompt-engineer delegation checklist tracks the live Arch H template", () => {
  it("cites the template as the single source, and the citation resolves", () => {
    expect(checklistLine()).toContain("06-context-arch-h.md");
    expect(existsSync(resolve(root, TEMPLATE_REL))).toBe(true);
    expect(templateBlocks().length).toBeGreaterThan(0);
  });

  it("names no block the template does not define", () => {
    const defined = new Set(templateBlocks());
    const named = [...checklistLine().matchAll(/`\[([^\]]+)\]`/g)].map((m) => m[1].split(" - ")[0].trim());
    expect(named.filter((b) => !defined.has(b))).toEqual([]);
  });
});
