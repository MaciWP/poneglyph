import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Quality review 2026-09-11, finding H42: the consult skill drifted away from the bridges it
// documents. Re-verified against the installed plugin caches on 2026-09-11:
//   - codex-companion.mjs:644 and grok-bridge.mjs:592 both accept `--prompt-file`
//   - scripts/lib/args.mjs treats `-` as a POSITIONAL, so `… | node bridge -` sends the
//     literal prompt "-"; piped stdin works only with no positional at all
//   - grok.mjs:166 re-passes the prompt to the Grok CLI as `-p <prompt>` argv
//   - both `config.toml` profiles now read model_reasoning_effort = "high", not "xhigh"
// The skill is prose, so these assertions are what makes the correction checkable.
const root = resolve(import.meta.dir, "..", "..", "..");
const md = readFileSync(join(root, ".claude", "skills", "consult", "SKILL.md"), "utf8");
// Markdown escapes the pipe inside table cells; compare against the unescaped text.
const flat = md.split("\\|").join("|");

describe("consult — documented adapters match the installed bridges (H42)", () => {
  it("does not present a trailing `-` as stdin", () => {
    expect(md).not.toMatch(/\|\s*\.{3}\s*-`/);
  });

  it("names --prompt-file for both bridges, not once in passing", () => {
    expect(md.match(/--prompt-file/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("states the command-line ceiling that makes --prompt-file necessary", () => {
    expect(md).toContain("32,767");
  });

  it("documents Grok's three effort values", () => {
    expect(flat).toContain("low|medium|high");
  });

  it("does not pin a config value that already moved", () => {
    expect(md).not.toMatch(/today `gpt-6-astra` at `xhigh`/);
  });
});
