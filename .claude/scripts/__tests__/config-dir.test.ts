import { expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { memoryFile } from "../../hooks/router/memory";

// `CLAUDE_CONFIG_DIR` moves the whole Claude Code config, transcripts and memory included.
// A script that builds `~/.claude` by hand reads the wrong directory once it is set, so every
// source resolves it through `claudeConfigDir()` in `hooks/lib/paths.ts`.
const root = resolve(import.meta.dir, "..", "..", "..");
const OWNER = ".claude/hooks/lib/paths.ts";
const HAND_BUILT = /(homedir|getHomeDir)\(\),\s*"\.claude"|CLAUDE_CONFIG_DIR\s*\|\|/;
// The sync scripts install into ~/.claude on purpose; a line that does says so with this marker.
const INSTALL_TARGET = "config-dir: install target";

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
    return text.split("\n").flatMap((line, i) => (HAND_BUILT.test(line) && !line.includes(INSTALL_TARGET) ? [`${f}:${i + 1}`] : []));
  });
  expect(offenders).toEqual([]);
});

// The router memory holds real prompts: its file must live in the config dir, never in the repo.
it("memoryFile() resolves outside the repo root", () => {
  const rel = relative(root, memoryFile());
  // On Windows the repo and the config dir can sit on different drives: relative() is then absolute.
  expect(rel.startsWith("..") || isAbsolute(rel)).toBe(true);
});
