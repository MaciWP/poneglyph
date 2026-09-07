import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateSettings, stripFrontmatter } from "../../commands/sync-claude.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("optional machine addon activation", () => {
  it("keeps the public base independent and preserves an opt-in across repeated syncs", () => {
    const root = mkdtempSync(join(tmpdir(), "poneglyph-machine-test-")); roots.push(root);
    const repo = join(root, "repo"), profile = join(root, "profile");
    mkdirSync(join(repo, ".claude"), { recursive: true });
    const basePath = join(repo, ".claude/settings.global.json");
    const base = JSON.stringify({ env: { SHARED: "kept" }, enabledPlugins: { "public-plugin": true } });
    writeFileSync(basePath, base);
    expect(generateSettings(repo, profile, { execute: true, backup: false }).status).toBe("written");
    const installed = () => JSON.parse(readFileSync(join(profile, ".claude/settings.json"), "utf8"));
    expect(installed().enabledPlugins).toEqual({ "public-plugin": true });
    writeFileSync(join(repo, ".claude/settings.machine.json"), JSON.stringify({ env: { MACHINE: "kept" }, enabledPlugins: { "private-addon": true } }));
    for (let i = 0; i < 2; i++) {
      expect(generateSettings(repo, profile, { execute: true, backup: false }).overlayApplied).toBe(true);
      expect(installed().enabledPlugins).toEqual({ "public-plugin": true, "private-addon": true });
      expect(installed().env).toEqual({ SHARED: "kept", MACHINE: "kept" });
      expect(readFileSync(basePath, "utf8")).toBe(base);
    }
    writeFileSync(join(repo, ".claude/settings.machine.json"), JSON.stringify({ enabledPlugins: { "private-addon": false } }));
    generateSettings(repo, profile, { execute: true, backup: false });
    expect(installed().enabledPlugins["private-addon"]).toBe(false);
  });
});

describe("system-prompt twin generation (output style = SSOT)", () => {
  const style = `---\nname: Poneglyph\nkeep-coding-instructions: true\n# SSOT — edit THIS file\n---\n\n# Poneglyph\n\nLaw body here.\n`;

  it("strips the frontmatter (YAML comments included) leaving a clean body", () => {
    const body = stripFrontmatter(style);
    expect(body).toStartWith("# Poneglyph");
    expect(body).toContain("Law body here.");
    expect(body).not.toContain("---");
    expect(body).not.toContain("keep-coding-instructions");
  });

  // core.autocrlf=true checks the SSOT out with CRLF on Windows. The LF-only
  // pattern used until 2026-08-23 did not match it, so the whole frontmatter
  // leaked into the twin that Grok, Codex and pi consume as a system prompt.
  const styleCrlf = style.replace(/\n/g, "\r\n");

  it("strips a CRLF frontmatter and normalizes the body to LF", () => {
    const body = stripFrontmatter(styleCrlf);
    expect(body).toStartWith("# Poneglyph");
    expect(body).not.toContain("---");
    expect(body).not.toContain("keep-coding-instructions");
    expect(body).not.toContain("\r");
  });

  it("gives the same body for CRLF and LF input", () => {
    expect(stripFrontmatter(styleCrlf)).toBe(stripFrontmatter(style));
  });

  it("passes through content without frontmatter untouched", () => {
    expect(stripFrontmatter("# Solo cuerpo\n")).toBe("# Solo cuerpo\n");
  });

  it("is idempotent and trailing-whitespace stable", () => {
    const once = stripFrontmatter(style);
    expect(stripFrontmatter(once)).toBe(once);
    expect(stripFrontmatter(style + "\n\n")).toBe(once);
  });
});
