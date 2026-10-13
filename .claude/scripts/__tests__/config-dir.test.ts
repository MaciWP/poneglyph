import { expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// `CLAUDE_CONFIG_DIR` moves the whole Claude Code config, transcripts and memory included.
// A script that builds `~/.claude` by hand reads the wrong directory once it is set, so every
// source resolves it through `claudeConfigDir()` in `hooks/lib/paths.ts`.
const root = resolve(import.meta.dir, "..", "..", "..");
const OWNER = ".claude/hooks/lib/paths.ts";
const HAND_BUILT = /homedir\(\),\s*"\.claude"|CLAUDE_CONFIG_DIR\s*\|\|/;

it("only hooks/lib/paths.ts resolves the Claude config dir", () => {
  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", ".claude"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(ts|mjs|js)$/.test(f) && f !== OWNER && !/__tests__|\.test\.|_archive\/|\/synced\/|\.trash\//.test(f));
  const offenders = files.flatMap((f) => {
    let text: string;
    try {
      text = readFileSync(join(root, f), "utf8");
    } catch {
      return []; // listed by git but deleted in the working tree
    }
    return text.split("\n").flatMap((line, i) => (HAND_BUILT.test(line) ? [`${f}:${i + 1}`] : []));
  });
  expect(offenders).toEqual([]);
});
