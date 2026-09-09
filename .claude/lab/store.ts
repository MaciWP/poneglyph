import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, fsyncSync, lstatSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

export type Host = "claude" | "codex" | "grok";
export type Kind = "prompt" | "profile" | "scenario" | "experiment";
export interface Condition { id: string; profile: string; prompt: string }
export interface Recipe {
  version: 1; name: string; host: Host; model: string; mode: "live" | "simulation";
  factor: "profile" | "prompt" | "exploratory"; seed: number; trials: number;
  scenarios: string[]; conditions: Condition[];
  limits: { maxRuns: number; secondsPerRun: number; totalSeconds: number };
}
export interface Assignment { id: string; scenario: string; trial: number; condition: string; order: number }
export interface Check { name: string; passed: boolean; critical: boolean }
export interface RunRecord extends Assignment {
  status: string; accepted: boolean; seconds: number | null; verifierSeconds: number | null;
  checks: Check[]; regressions: number; model: string | null;
  usage: Record<string, number> | null; apiEquivalentUsd: number | null;
}
export const identifier = (s: unknown): s is string => typeof s === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(s);
export const hashId = (s: unknown): s is string => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (value === undefined || typeof value === "function" || typeof value === "bigint" || (typeof value === "number" && !Number.isFinite(value))) throw new Error("Non-JSON value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
}
export const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
export function within(root: string, relative: string): string {
  const base = resolve(root), target = resolve(base, relative);
  const normalize = (s: string) => process.platform === "win32" ? s.toLowerCase() : s;
  if (!normalize(target).startsWith(normalize(base + sep))) throw new Error("Path escapes laboratory root");
  for (let p = target; normalize(p) !== normalize(base); p = dirname(p)) {
    if (existsSync(p) && lstatSync(p).isSymbolicLink()) throw new Error("Linked laboratory path");
  }
  return target;
}
export function atomicJSON(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + "." + randomUUID() + ".tmp";
  const fd = openSync(temp, "wx", 0o600);
  try { writeFileSync(fd, canonical(value) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, file);
  if (process.platform !== "win32") { const d = openSync(dirname(file), "r"); try { fsyncSync(d); } finally { closeSync(d); } }
}
export function saveVersion(root: string, kind: Kind, data: unknown): string {
  if (!["prompt","profile","scenario","experiment"].includes(kind)) throw new Error("Invalid object kind");
  const id = hash(data), file = within(root, join("objects", kind, id + ".json"));
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  try { writeFileSync(file, canonical(data) + "\n", { flag: "wx", mode: 0o600 }); }
  catch (e: any) { if (e.code !== "EEXIST") throw e; loadVersion(root, kind, id); }
  return id;
}
export function loadVersion<T = unknown>(root: string, kind: Kind, id: string): T {
  if (!["prompt","profile","scenario","experiment"].includes(kind)) throw new Error("Invalid object kind");
  if (!hashId(id)) throw new Error("Invalid version hash");
  const value = JSON.parse(readFileSync(within(root, join("objects", kind, id + ".json")), "utf8"));
  if (hash(value) !== id) throw new Error("Stored version hash mismatch");
  return value;
}
export function validateRecipe(value: unknown): Recipe {
  const p = value as Recipe;
  const positive = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0;
  if (!p || p.version !== 1 || !identifier(p.name) || !["claude", "grok", "codex"].includes(p.host) || typeof p.model !== "string" || !p.model.trim() || p.model.startsWith("-") || !["live", "simulation"].includes(p.mode) || !["profile", "prompt", "exploratory"].includes(p.factor) || !Number.isSafeInteger(p.seed) || p.seed < 0 || p.seed > 0xffffffff || !Number.isInteger(p.trials) || p.trials < 1 || p.trials > 10) throw new Error("Invalid experiment identity/model/trials");
  if (!Array.isArray(p.scenarios) || !p.scenarios.length || !p.scenarios.every(identifier) || new Set(p.scenarios).size !== p.scenarios.length) throw new Error("Invalid or duplicate scenarios");
  if (!Array.isArray(p.conditions) || !p.conditions.length || p.conditions.some(c => !c || !identifier(c.id) || !hashId(c.profile) || !hashId(c.prompt)) || new Set(p.conditions.map(c => c.id)).size !== p.conditions.length) throw new Error("Invalid or duplicate conditions");
  if (!p.limits || !Number.isSafeInteger(p.limits.maxRuns) || !positive(p.limits.maxRuns) || !positive(p.limits.secondsPerRun) || !positive(p.limits.totalSeconds) || p.limits.maxRuns < p.scenarios.length * p.conditions.length * p.trials) throw new Error("Missing or insufficient execution limits");
  if (p.factor === "profile" && new Set(p.conditions.map(c => c.prompt)).size !== 1) throw new Error("Profile comparison must hold the prompt fixed");
  if (p.factor === "prompt" && new Set(p.conditions.map(c => c.profile)).size !== 1) throw new Error("Prompt comparison must hold the profile fixed");
  return structuredClone(p);
}
export function schedule(recipe: Recipe): Assignment[] {
  const p = validateRecipe(recipe); let state = p.seed;
  const random = () => { state += 0x6d2b79f5; let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
  const result: Assignment[] = [];
  for (const scenario of p.scenarios) for (let trial = 1; trial <= p.trials; trial++) {
    const block = [...p.conditions];
    for (let i = block.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [block[i], block[j]] = [block[j], block[i]]; }
    for (const c of block) result.push({ id: `${scenario}.t${trial}.${c.id}`, scenario, trial, condition: c.id, order: result.length + 1 });
  }
  return result;
}
