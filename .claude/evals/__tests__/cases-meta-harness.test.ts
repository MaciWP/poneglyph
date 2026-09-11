import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { skillTriggerParse } from "../graders";

const casesPath = join(import.meta.dir, "..", "cases.jsonl");

type EvalCase = {
  id: string;
  prompt: string;
  type: string;
  grader: string;
  expected: string;
};

function loadCases(): EvalCase[] {
  return readFileSync(casesPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as EvalCase);
}

const VERBS: { verb: string; needles: string[] }[] = [
  { verb: "crear", needles: ["crea", "crear", "añade", "nueva"] },
  { verb: "modificar", needles: ["modifica", "cambia", "edita"] },
  { verb: "borrar", needles: ["borra", "elimina", "quita"] },
  { verb: "consultar", needles: ["consulta", "qué ha cambiado", "docs oficiales"] },
];

describe("US4 meta-harness skill-trigger cases", () => {
  test("T4.1 four es-ES trigger cases expect meta-harness", () => {
    const rows = loadCases().filter((c) => c.type === "skill-trigger" && c.expected === "meta-harness");
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const byId = rows.filter((c) => c.id.startsWith("skill-meta-harness-"));
    const pool = byId.length >= 4 ? byId : rows;
    expect(pool.length).toBeGreaterThanOrEqual(4);
    for (const row of pool) {
      expect(row.grader).toBe("skillTriggerParse");
      expect(/[áéíóúñ¿¡]|crea|modifica|borra|consulta|añade|permisos|skill/i.test(row.prompt)).toBe(true);
      expect(/^[A-Za-z0-9 ,.'!?-]+$/.test(row.prompt) && !/[áéíóúñ¿¡]/.test(row.prompt) && !/\b(crea|modifica|borra|consulta)\b/i.test(row.prompt)).toBe(false);
    }
    for (const { verb, needles } of VERBS) {
      const hit = pool.some((c) => needles.some((n) => c.prompt.toLowerCase().includes(n)));
      expect({ verb, hit }).toEqual({ verb, hit: true });
    }
  });

  test("T4.2 stubs are not the expected skill", () => {
    const rows = loadCases().filter((c) => c.id.startsWith("skill-meta-harness-"));
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const row of rows) {
      expect(row.expected).toBe("meta-harness");
      expect(row.expected).not.toBe("meta-create");
      expect(row.expected).not.toBe("meta-settings-cookbook");
    }
  });

  test("T4.3 grader accepts expected meta-harness (pin)", () => {
    const skillEvent = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "meta-harness" } }] },
    });
    const textEvent = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "hola" }] },
    });
    expect(skillTriggerParse([textEvent, skillEvent].join("\n"), { expected: "meta-harness" }).pass).toBe(true);
    const miss = skillTriggerParse(textEvent, { expected: "meta-harness" });
    expect(miss.pass).toBe(false);
    expect(miss.detail).toContain("meta-harness");
  });
});
