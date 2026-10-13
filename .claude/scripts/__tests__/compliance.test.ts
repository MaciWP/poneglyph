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
