import { describe, expect, it } from "bun:test";
import { complianceRow, parseComplianceTurns, RULES, summarizeCompliance, type RuleResult } from "../compliance";

const human = (content: string, ts = "2026-10-01T10:00:00.000Z") => JSON.stringify({ type: "user", timestamp: ts, message: { role: "user", content } });
let msg = 0;
const assistant = (blocks: object[], stop = "end_turn", model = "claude-opus-5-5") =>
  JSON.stringify({ type: "assistant", message: { id: `m${++msg}`, model, stop_reason: stop, content: blocks } });
const text = (t: string) => ({ type: "text", text: t });
const tool = (name: string, input: object) => ({ type: "tool_use", name, input });
const rule = (id: string) => RULES.find((r) => r.id === id)!.check;

describe("parseComplianceTurns", () => {
  it("keeps only finished turns of style-following models, one per human prompt", () => {
    const turns = parseComplianceTurns([
      human("primera petición"),
      assistant([text("**Hecho.**\nROBIN: hecho.")]),
      human("segunda"),
      assistant([text("parcial")], "tool_use"),
      human("tercera"),
      assistant([text("**Sí.**\nROBIN: sí.")], "end_turn", "claude-fable-5-1"),
    ]);
    expect(turns.length).toBe(1);
    expect(turns[0].texts).toEqual(["**Hecho.**\nROBIN: hecho."]);
  });

  it("counts a review only when a check runs after the last code edit", () => {
    const [late] = parseComplianceTurns([
      human("arregla"),
      assistant([tool("Bash", { command: "bun test" }), tool("Edit", { file_path: "/r/a.ts" })], "tool_use"),
      assistant([text("**Hecho.**\nROBIN: hecho.")]),
    ]);
    expect(rule("C-REVIEW")(late)).toBe(false);
    const [ok] = parseComplianceTurns([
      human("arregla"),
      assistant([tool("Edit", { file_path: "/r/a.ts" }), tool("Bash", { command: "bun test" })], "tool_use"),
      assistant([text("**Hecho.**\nROBIN: hecho.")]),
    ]);
    expect(rule("C-REVIEW")(ok)).toBe(true);
  });

  it("carries session skills across turns for the harness-config rule", () => {
    const turns = parseComplianceTurns([
      human("uno"),
      assistant([tool("Skill", { skill: "harness-config" })], "tool_use"),
      assistant([text("**Vale.**\nROBIN: vale.")]),
      human("dos"),
      assistant([tool("Edit", { file_path: "/r/.claude/skills/x/SKILL.md" })], "tool_use"),
      assistant([text("**Hecho.**\nROBIN: hecho.")]),
    ]);
    expect(rule("C-HCONFIG")(turns[1])).toBe(true);
  });

  it("a harness-config load in a later turn does not excuse an earlier config edit", () => {
    const turns = parseComplianceTurns([
      human("uno"),
      assistant([tool("Edit", { file_path: "/r/.claude/skills/x/SKILL.md" })], "tool_use"),
      assistant([text("**Hecho.**\nROBIN: hecho.")]),
      human("dos"),
      assistant([tool("Skill", { skill: "harness-config" })], "tool_use"),
      assistant([text("**Vale.**\nROBIN: vale.")]),
    ]);
    expect(rule("C-HCONFIG")(turns[0])).toBe(false);
    expect(rule("C-HCONFIG")(turns[1])).toBeNull();
  });
});

describe("rules", () => {
  const turn = (final: string, extra: object = {}) => ({ ...parseComplianceTurns([human("x"), assistant([text(final)])])[0], ...extra });

  it("a text question or Espera line without the question tool fails S-ASK", () => {
    expect(rule("S-ASK")(turn("**Hecho.**\n¿Borramos el endpoint?\nROBIN: hecho."))).toBe(false);
    expect(rule("S-ASK")(turn("**Hecho.**\nEspera tu decisión: borrar o no.\nROBIN: hecho."))).toBe(false);
    expect(rule("S-ASK")(turn("**Hecho.**\nROBIN: hecho."))).toBeNull();
  });

  it("shape rules read the final answer", () => {
    const good = turn("**Sí.**\nAviso: la rama va detrás.\nROBIN: sí.");
    for (const id of ["S-BOLD", "S-ROBIN", "S-AVISO", "S-ESES", "S-TICS", "S-DASH"]) expect(rule(id)(good)).toBe(true);
    const bad = turn("¡Buena pregunta! The answer is that it works — mostly.\nAviso: x\nAviso: y");
    for (const id of ["S-BOLD", "S-ROBIN", "S-AVISO", "S-TICS", "S-DASH"]) expect(rule(id)(bad)).toBe(false);
  });
});

describe("rules, positive and negative", () => {
  const base = parseComplianceTurns([human("x"), assistant([text("**Hecho.**\nROBIN: hecho.")])])[0];
  const t = (extra: object = {}) => ({ ...base, ...extra });
  const final = (s: string) => t({ texts: [s] });
  const err = (e: string) => e;
  const cases: [string, object, boolean | null, object, boolean | null][] = [
    ["C-RETRY", { errors: [err("boom 1"), err("boom 2")] }, true, { errors: [err("boom 1"), err("boom 2"), err("boom 3")] }, false],
    ["C-STOP", { texts: ["**Hecho.**\nROBIN: hecho."] }, true, { texts: ["**Hecho.**\n¿Sigo con lo demás?\nROBIN: hecho."] }, false],
    ["C-SENS", { edits: ["/r/package.json"], texts: ["sensitive: añade un script\n**Hecho.**"] }, true, { edits: ["/r/package.json"] }, false],
    ["C-NOAI", { bash: ["git commit -m 'fix'"] }, true, { bash: ["git commit -m 'fix\n\nCo-Authored-By: Claude <x@y>'"] }, false],
    ["C-MODEL", { spawns: [{ model: "haiku" }, { type: "fork" }] }, true, { spawns: [{ type: "Explore" }] }, false],
    ["C-HCONFIG", { edits: ["/r/CLAUDE.md"], sessionSkills: new Set(["harness-config"]) }, true, { edits: ["/r/CLAUDE.md"], sessionSkills: new Set() }, false],
    ["S-ESES", { texts: ["**Hecho.** Ya está el cambio en el fichero y funciona.\nROBIN: hecho."] }, true, { texts: ["**Done.** The change is in the file and it works fine for the whole team.\nROBIN: done."] }, false],
    ["S-ESES-MID", { texts: ["Estoy mirando el código del módulo.", "**Hecho.**"] }, true, { texts: ["I am looking at the code of the module now.", "**Hecho.**"] }, false],
    ["S-FICHERO", { texts: ["**Hecho.** Edité el fichero."] }, true, { texts: ["**Hecho.** Edité el archivo."] }, false],
    ["S-ASK3", { asks: [{ questions: [1, 2, 3] }] }, true, { asks: [{ questions: [1, 2, 3, 4] }] }, false],
    ["S-HEDGE", { texts: ["**Hecho.** Creo que sí. [Suposición: el CI es igual]"] }, true, { texts: ["**Hecho.** Creo que sí."] }, false],
    ["S-HEAD", { texts: ["**Hecho.**\n## Resumen"] }, true, { texts: ["**Hecho.**\n## 🚀 Resumen"] }, false],
    ["S-SEP", { texts: ["**Hecho.**\nROBIN: hecho."] }, true, { texts: ["**Hecho.**\n---\nROBIN: hecho."] }, false],
    ["S-CHECK", { texts: ["**Hecho.** ✅ pasa el test"] }, true, { texts: ["**Hecho.** ✅ hecho"] }, false],
    ["S-SCREEN", { texts: ["**Hecho.**\n" + "línea\n".repeat(10)] }, true, { texts: ["**Hecho.**\n" + "línea\n".repeat(60)] }, false],
    ["S-NARR", { texts: ["Cambio el nombre.", "**Hecho.**"] }, true, { texts: ["Voy a leer el fichero.", "**Hecho.**"] }, false],
  ];
  for (const [id, good, goodExpect, bad, badExpect] of cases) {
    it(`${id} passes a compliant turn and fails a violating one`, () => {
      expect(rule(id)(t(good))).toBe(goodExpect as boolean);
      expect(rule(id)(t(bad))).toBe(badExpect as boolean);
    });
  }

  it("rules with a precondition return null when it does not hold", () => {
    for (const id of ["C-RETRY", "C-SENS", "C-NOAI", "C-MODEL", "C-HCONFIG", "S-ESES-MID", "S-ASK3", "S-HEDGE", "S-NARR"]) expect(rule(id)(final("**Hecho.**"))).toBeNull();
  });
});

describe("complianceRow", () => {
  const r = (id: string, pass: number, n: number): RuleResult => ({ id, source: "style", rule: id, pass, n });

  it("warns on a weak rule with enough turns, ignores small samples", () => {
    expect(complianceRow([r("A", 9, 10), r("B", 1, 5)], 20).status).toBe("🟢");
    const row = complianceRow([r("A", 9, 10), r("B", 2, 10)], 20);
    expect(row.status).toBe("🟡");
    expect(row.detail).toContain("B 20 %");
  });

  it("summarizes rules that do not apply as zero turns", () => {
    const [res] = summarizeCompliance([], [{ id: "X", source: "style", rule: "x", check: () => null }]);
    expect(res).toEqual({ id: "X", source: "style", rule: "x", pass: 0, n: 0 });
  });
});
