import * as fs from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";
import type { NativeHost } from "../../hooks/native-hook";

type RecordValue = Record<string, any>;
function record(value: unknown): asserts value is RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid hook configuration object.");
}

/** Recovery stays outside every skill discovery root, including account profiles. */
export function backupDestination(dest: string): string {
  const root = path.join(process.env.LOCALAPPDATA ?? path.join(homedir(), ".local", "share"), "Poneglyph", "installation-backups");
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, "sync-"));
  fs.writeFileSync(path.join(dir, "origin.json"), JSON.stringify({ path: dest }) + "\n");
  return path.join(dir, path.basename(dest));
}

export function nativeHookConfig(host: NativeHost, coreRoot: string): RecordValue {
  const script = path.resolve(coreRoot, ".claude/hooks/native-hook.ts").replaceAll("\\", "/");
  // Double-quoted paths work in the supported shells. Reject expansion characters
  // instead of treating JSON escaping as shell quoting.
  if (/["`$%!\r\n]/.test(script)) throw new Error("Installation path cannot be safely quoted for a hook command.");
  const entry = (event: string, matcher?: string) => ({
    ...(matcher ? { matcher } : {}),
    hooks: [{ type: "command", command: `bun "${script}" --host ${host} --event ${event}`, timeout: 10 }],
  });
  return { hooks: {
    PreToolUse: [entry("PreToolUse", "Bash")],
    ...(host === "codex" ? { UserPromptSubmit: [entry("UserPromptSubmit")], Stop: [entry("Stop")] } : {}),
  } };
}

/** Replace only exact owned commands. Unknown hooks and their group fields survive. */
export function mergeNativeHooks(existing: unknown, desired: RecordValue, install = true): RecordValue {
  record(existing);
  const hooks = existing.hooks ?? {};
  record(hooks);
  const commands = new Set<string>(Object.values(desired.hooks).flatMap((groups: any) => groups.flatMap((g: any) => g.hooks.map((h: any) => h.command))));
  const result: RecordValue = {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) throw new Error("Invalid hook event groups.");
    result[event] = groups.flatMap(group => {
      record(group);
      if (!Array.isArray(group.hooks)) throw new Error("Invalid hook handlers.");
      const handlers = group.hooks.filter((hook: unknown) => {
        record(hook);
        if (typeof hook.command === "string" && /[\\/]native-hook\.ts["']?\s+--host\s/.test(hook.command) && !commands.has(hook.command)) {
          throw new Error("A different Poneglyph native hook is installed; review its source before replacing it.");
        }
        return !commands.has(hook.command);
      });
      return handlers.length ? [{ ...group, hooks: handlers }] : [];
    });
  }
  if (install) for (const [event, groups] of Object.entries(desired.hooks)) result[event] = [...(result[event] ?? []), ...(groups as unknown[])];
  return { ...existing, hooks: result };
}

export function hookFilePlan(file: string, desired: RecordValue, install = true): { status: "linked" | "missing" | "stale"; content: string } {
  const exists = fs.existsSync(file);
  const existing = exists ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const merged = mergeNativeHooks(existing, desired, install);
  return {
    status: !exists ? "missing" : JSON.stringify(existing) === JSON.stringify(merged) ? "linked" : "stale",
    content: JSON.stringify(merged, null, 2) + "\n",
  };
}

export function installHookFile(file: string, desired: RecordValue, install = true): void {
  const plan = hookFilePlan(file, desired, install);
  if (plan.status === "linked") return;
  // Validate and back up before replacing settings. Preserve an existing file link.
  if (fs.existsSync(file)) {
    const backup = backupDestination(file);
    fs.copyFileSync(file, backup);
    if (!fs.readFileSync(file).equals(fs.readFileSync(backup))) throw new Error("Hook recovery verification failed.");
    console.log(`backup: ${file} -> ${backup}`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, plan.content);
}
