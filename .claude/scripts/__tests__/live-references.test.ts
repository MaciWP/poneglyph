import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Quality review 2026-09-11, findings H25 and H26 and the rot class behind them.
// Commandment IX says the system does not rot, but nothing enforced it: a component could
// be deleted and its name survive in live prose for weeks, telling the agent to read a file
// that is gone.
//
// Scope is deliberately narrow. A generic "every path in backticks must exist" sweep was
// tried first and produced 30+ hits that are NOT defects: test fixtures that name a missing
// file on purpose, host paths a reference pack documents for machines that are not this one
// (`.grok/config.toml`), and example paths inside prose. A CI gate that cries wolf is worse
// than no gate. What IS unambiguous is a retired name presented as live, so that is what
// this test locks. Add a name here whenever a component is removed.
const root = resolve(import.meta.dir, "..", "..", "..");

const RETIRED = [
  "post-compact.ts",
  "workspace-hint.ts",
  "anti-hallucination",
  "ultracode-audit",
  "flow-build",
  "token-trend",
  "meta-create",
  "meta-settings-cookbook",
  "lsp-operations",
];

// Dated history records what was true on its date; a decision log and a lessons row must
// keep naming what they are about. Tests name retired components on purpose: that is here.
const ALLOWED = /^\.claude\/(plans|audits)\/|^docs\/component-audit|__tests__|existence-checks\.md$|lessons\/SKILL\.md$|doctrine-sweep\.md$|history\.md$/;
// A sentence that says the thing is gone is documentation, not rot.
const RETIRED_NEARBY = /\b(cut|retired|removed|deleted|replaced by|no longer|gone)\b/i;

function liveFiles(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(md|ts|js|jsonl|json)$/.test(f) && !ALLOWED.test(f));
}

// Word-boundary match, so a plan slug like `037-meta-create-harness` is not a mention of
// the `meta-create` skill.
function mentions(text: string, name: string): number[] {
  const re = new RegExp(`(^|[^\\w-])${name.replace(/[.]/g, "\\.")}($|[^\\w-])`, "g");
  return [...text.matchAll(re)].map((m) => m.index ?? 0);
}

describe("live files never present a retired component as current", () => {
  it("scans a real corpus", () => {
    expect(liveFiles().length).toBeGreaterThan(100);
  });

  it("names no retired component as current", () => {
    const hits: string[] = [];
    for (const f of liveFiles()) {
      const text = readFileSync(join(root, f), "utf8");
      for (const name of RETIRED) {
        for (const at of mentions(text, name)) {
          const around = text.slice(Math.max(0, at - 200), at + 200);
          if (!RETIRED_NEARBY.test(around)) hits.push(`${f} -> ${name}`);
        }
      }
    }
    expect([...new Set(hits)]).toEqual([]);
  });
});
