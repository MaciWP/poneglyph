import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { learnedLog } from "../lib/paths";
import { ignoreLearned } from "./learned-fixture";

describe("learnedLog: inside the project only when it git-ignores the logs", () => {
  const scratch = mkdtempSync(join(tmpdir(), "poneglyph-paths-test-"));
  const config = join(scratch, "config");
  const saved = { project: process.env.CLAUDE_PROJECT_DIR, config: process.env.CLAUDE_CONFIG_DIR };

  beforeAll(() => {
    delete process.env.CLAUDE_PROJECT_DIR; // the payload cwd is the root
    process.env.CLAUDE_CONFIG_DIR = config;
  });
  afterAll(() => {
    for (const [key, value] of [["CLAUDE_PROJECT_DIR", saved.project], ["CLAUDE_CONFIG_DIR", saved.config]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(scratch, { recursive: true, force: true });
  });

  test("a git repo that ignores .claude/learned/ keeps the log in the project", () => {
    const repo = ignoreLearned(join(scratch, "ignored"));
    expect(learnedLog(repo, "a.log")).toBe(join(repo, ".claude", "learned", "a.log"));
  });

  test("a git repo that does not ignore it logs under the config dir, one folder per project", () => {
    const repo = join(scratch, "tracked");
    spawnSync("git", ["init", "-q", repo]);
    expect(learnedLog(repo, "a.log")).toBe(join(config, "learned", repo.replace(/[^\w.-]+/g, "-"), "a.log"));
  });

  test("a directory outside any git repo counts as not ignored", () => {
    const plain = mkdtempSync(join(scratch, "plain-"));
    expect(learnedLog(plain, "a.log").startsWith(join(config, "learned"))).toBe(true);
  });

  test("the verdict is cached per project root for the process", () => {
    const repo = ignoreLearned(join(scratch, "cached"));
    expect(learnedLog(repo, "a.log")).toBe(join(repo, ".claude", "learned", "a.log"));
    writeFileSync(join(repo, ".gitignore"), "");
    expect(learnedLog(repo, "a.log")).toBe(join(repo, ".claude", "learned", "a.log"));
  });
});
