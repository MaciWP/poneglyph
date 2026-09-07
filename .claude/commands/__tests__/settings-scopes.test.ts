import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const claudeDir = path.resolve(import.meta.dir, "../..");
const projectSettings = JSON.parse(
  readFileSync(path.join(claudeDir, "settings.json"), "utf8"),
) as Record<string, unknown>;
const globalSettings = JSON.parse(
  readFileSync(path.join(claudeDir, "settings.global.json"), "utf8"),
) as Record<string, unknown>;

describe("Claude settings scopes", () => {
  // Class guard, not instance guard: ANY global-profile key re-added to the
  // project scope (hooks, permissions, env, statusLine, ...) would load twice
  // (user + project) while developing Poneglyph. Whitelist what may exist here.
  it("keeps the project profile minimal (scope whitelist)", () => {
    expect(Object.keys(projectSettings).sort()).toEqual(["$schema", "respectGitignore"]);
  });

  it("keeps the complete global profile in the sync source", () => {
    expect(globalSettings.hooks).toBeDefined();
    expect(globalSettings.permissions).toBeDefined();
    expect(globalSettings.outputStyle).toBe("Poneglyph");
  });
});
