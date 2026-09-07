#!/usr/bin/env bun
// Grok already discovers the Claude installation. Install only missing native surfaces.
import * as fs from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { parse, stringify } from "smol-toml";
import { createLink, linkStatus, type CodexLink } from "./sync-codex";
import { backupDestination, hookFilePlan, installHookFile, nativeHookConfig } from "./lib/native-hooks";

export function grokCompatPlan(text: string): { changed: boolean; content: string } {
  const config = parse(text) as Record<string, any>;
  if (config.compat?.claude?.hooks === false) return { changed: false, content: text };
  config.compat = { ...config.compat, claude: { ...config.compat?.claude, hooks: false } };
  return { changed: true, content: stringify(config) };
}

export function buildGrokLinks(coreRoot: string, home: string): CodexLink[] {
  return [{
    source: path.join(coreRoot, ".claude", "system-prompts", "poneglyph-sp.md"),
    dest: path.join(home, ".grok", "rules", "poneglyph-sp.md"), type: "file",
  }];
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({ options: {
      status: { type: "boolean" }, execute: { type: "boolean" },
      backup: { type: "boolean" }, force: { type: "boolean" },
      "home-dir": { type: "string" }, help: { type: "boolean" },
    } });
    if (values.help) {
      console.log("sync-grok [--status|--execute] [--backup] [--force] [--home-dir PATH]\nReuse the Claude doctrine/skills installation; install the style twin and native PreToolUse adapter.\nDisable inherited Claude hooks while preserving other native configuration. No model or MCP connection is started.");
      process.exit(0);
    }
    if (values.execute && !values.force && !process.stdin.isTTY) throw new Error("Non-interactive installation requires --force.");
    const home = path.resolve(values["home-dir"] ?? homedir());
    const root = fs.realpathSync.native(path.resolve(import.meta.dir, "../.."));
    const links = buildGrokLinks(root, home);
    const configFile = path.join(home, ".grok", "config.toml");
    const configPlan = grokCompatPlan(fs.existsSync(configFile) ? fs.readFileSync(configFile, "utf8") : "");
    const hookFile = path.join(home, ".grok", "hooks", "poneglyph.json");
    const hooks = nativeHookConfig("grok", root);
    hookFilePlan(hookFile, hooks); // Validate before changing links or settings.
    const shared = path.join(home, ".claude", "CLAUDE.md");
    if (values.execute && !fs.existsSync(shared)) throw new Error("Install the shared Claude layer first; Grok reuses its doctrine and skills.");
    if (values.execute) {
      for (const link of links) {
        if (!fs.existsSync(link.source)) throw new Error("Missing generated style source; run sync-claude first.");
        if (["local", "conflict"].includes(linkStatus(link)) && !values.backup) throw new Error("Review the existing style; replacement requires --backup.");
      }
      if (configPlan.changed && fs.existsSync(configFile) && !values.backup) throw new Error("Compatibility settings change requires --backup.");
      for (const link of links) createLink(link, values.backup ?? false);
      if (configPlan.changed) {
        if (fs.existsSync(configFile)) {
          const backup = backupDestination(configFile);
          fs.copyFileSync(configFile, backup);
          if (!fs.readFileSync(configFile).equals(fs.readFileSync(backup))) throw new Error("Grok recovery verification failed.");
          console.log(`backup: ${configFile} -> ${backup}`);
        }
        fs.mkdirSync(path.dirname(configFile), { recursive: true });
        fs.writeFileSync(configFile, configPlan.content);
      }
      installHookFile(hookFile, hooks);
    }
    for (const link of links) console.log(`${linkStatus(link).padEnd(8)} ${link.dest}`);
    console.log(`${hookFilePlan(hookFile, hooks).status.padEnd(8)} ${hookFile}`);
    console.log(`${(fs.existsSync(shared) ? "linked" : "missing").padEnd(8)} shared Claude installation`);
    const compat = fs.existsSync(configFile) && !grokCompatPlan(fs.readFileSync(configFile, "utf8")).changed;
    console.log(`${(compat ? "linked" : "stale").padEnd(8)} Grok compatibility: inherited Claude hooks disabled`);
    console.log("Native inspection and a user session are required to verify effective discovery and hook execution.");
  } catch {
    console.error("sync-grok failed: review the source paths, collisions and configuration; private details withheld.");
    process.exitCode = 1;
  }
}
