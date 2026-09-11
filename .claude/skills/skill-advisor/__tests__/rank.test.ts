import { describe, expect, test } from "bun:test";
import { rank, SHORTLIST_MAX, USAGE_TIER, type SkillMeta } from "../lib/rank";

const FIXTURES: SkillMeta[] = [
  { name: "review-patterns", description: "Code review: SOLID, performance, slow endpoint, N+1", keywords: ["performance", "slow", "endpoint", "refactor", "solid"] },
  { name: "security-audit", description: "Auth, jwt, password review", keywords: ["auth", "jwt", "security"] },
  { name: "tdd-design", description: "Test design before implementation", keywords: ["tests", "tdd", "oracle"] },
  { name: "drillme", description: "Socratic check for plans", keywords: ["drill", "socratic", "valida"] },
  { name: "scope", description: "Define product scope", keywords: ["scope", "alcance", "idea"] },
  { name: "build", description: "Implement one approved HU", keywords: ["build", "implementa", "ejecuta"] },
  { name: "critic", description: "End to end review", keywords: ["critic", "revisa", "audita"] },
  { name: "retro", description: "Retrospective", keywords: ["retro", "aprender"] },
];

describe("rank() — T1.1 happy: rankea y recorta a ≤5", () => {
  test("optimiza el endpoint lento → review-patterns primero, ≤5", () => {
    const out = rank("optimiza el endpoint lento de performance", FIXTURES);
    expect(out.length).toBeLessThanOrEqual(SHORTLIST_MAX);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].name).toBe("review-patterns");
  });
});

describe("rank() — T1.2 edge: ninguna relevante → vacío", () => {
  test("saludo no matchea nada", () => {
    expect(rank("hola buenos días", FIXTURES)).toEqual([]);
  });
});

describe("rank() — T1.3 edge: dedupe por nombre entre rutas", () => {
  test("drillme duplicada aparece una vez", () => {
    const dup = [...FIXTURES, { name: "drillme", description: "global copy", keywords: ["drill", "valida"] }];
    const out = rank("valida este plan con drill socratic", dup);
    expect(out.filter((s) => s.name === "drillme").length).toBe(1);
  });
});

describe("rank() — T1.4 property: ≤5 y sin duplicados", () => {
  test("invariante sobre listas variadas", () => {
    const tasks = ["refactor solid", "auth jwt login", "tests parser", "deploy prod", ""];
    for (let i = 0; i < tasks.length; i++) {
      const out = rank(tasks[i], FIXTURES);
      expect(out.length).toBeLessThanOrEqual(SHORTLIST_MAX);
      const names = out.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("usage tie-breaker (031 — census-derived)", () => {
  test("equal lexical score → higher usage tier wins", () => {
    const skills = [
      { name: "zzz-never-used", description: "valida planes", keywords: ["valida"] },
      { name: "drillme", description: "valida planes", keywords: ["valida"] },
    ];
    const out = rank("valida", skills);
    expect(out[0].name).toBe("drillme"); // usage tier 2 beats tier 0 despite alphabetical order
  });

  test("lexical score still dominates over usage", () => {
    const skills = [
      { name: "drillme", description: "valida", keywords: ["valida"] },
      { name: "unknown-skill", description: "valida planes de migración", keywords: ["valida", "planes", "migración"] },
    ];
    const out = rank("valida los planes de migración", skills);
    expect(out[0].name).toBe("unknown-skill");
  });

  test("USAGE_TIER map exists with census anchors", () => {
    expect(USAGE_TIER["tech-plan"]).toBe(2);
    expect(USAGE_TIER["drillme"]).toBe(2);
    expect(USAGE_TIER["consult"]).toBe(1);
    expect(USAGE_TIER["explain-changes"] ?? 0).toBe(0);
  });
});

// Quality review 2026-09-11, finding H46. USAGE_TIER was a hand-kept census snapshot. It
// named skills that no longer exist and omitted six that the sessions actually use, so the
// shortlist it ranks was scored against a catalog from another month.
import { readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
const repoRoot = resolve(import.meta.dir, "..", "..", "..", "..");
const catalog = readdirSync(join(repoRoot, ".claude", "skills"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(repoRoot, ".claude", "skills", e.name, "SKILL.md")))
  .map((e) => e.name);

describe("the usage tier map tracks the real catalog (H46)", () => {
  test("finds the catalog", () => {
    expect(catalog.length).toBeGreaterThan(20);
  });

  test("names no skill that is gone", () => {
    expect(Object.keys(USAGE_TIER).filter((n) => !catalog.includes(n))).toEqual([]);
  });
});
