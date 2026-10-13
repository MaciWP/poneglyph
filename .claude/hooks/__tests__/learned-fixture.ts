import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// A temp project whose `.claude/learned/` is git-ignored, so `learnedLog` writes inside it.
export function ignoreLearned(dir: string): string {
  mkdirSync(dir, { recursive: true });
  spawnSync("git", ["init", "-q", dir]);
  writeFileSync(join(dir, ".gitignore"), ".claude/learned/\n");
  return dir;
}
