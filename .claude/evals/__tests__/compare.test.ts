import { describe, test, expect } from "bun:test";
import { buildSides, metricsFor, parseClaudeJson, refCodeCount, PROBES } from "../compare";

describe("buildSides", () => {
  test("sp: A is style-off control, B adds the append-system-prompt-file flag", () => {
    const { a, b } = buildSides("sp", "/x/poneglyph-sp.md");
    expect(a.flags).toEqual(["--settings", '{"outputStyle":"default"}']);
    expect(b.flags).toContain("--append-system-prompt-file");
    expect(b.flags).toContain("/x/poneglyph-sp.md");
  });

  test("stock: A is --bare, B is the full layer (no flags)", () => {
    const { a, b } = buildSides("stock");
    expect(a.flags).toEqual(["--bare"]);
    expect(b.flags).toEqual([]);
  });

  test("style-vs-sp: exactly one side carries the sp file", () => {
    const { a, b } = buildSides("style-vs-sp", "/x/sp.md");
    expect(a.flags).not.toContain("--append-system-prompt-file");
    expect(b.flags).toContain("--append-system-prompt-file");
  });

  test("dupe: B stacks the append on top of the default (style-on) config", () => {
    const { a, b } = buildSides("dupe", "/x/sp.md");
    expect(a.flags).toEqual([]);
    expect(b.flags).toEqual(["--append-system-prompt-file", "/x/sp.md"]);
  });

  test("unknown preset throws with the preset name", () => {
    expect(() => buildSides("nope")).toThrow('unknown preset "nope"');
  });
});

describe("metricsFor", () => {
  test("counts chars/words and reports style markers per grader", () => {
    const m = metricsFor("El endpoint falla por un guard ausente. `[Suposición — verificar en auth.ts]`");
    expect(m.chars).toBeGreaterThan(0);
    expect(m.words).toBeGreaterThan(5);
    expect(m.markers.esEsDetect).toBe(true);
    expect(m.markers.labelPresence).toBe(true);
    expect(m.markers.bannedOpeners).toBe(true);
  });

  test("english stock-style output flips the es-ES and label markers", () => {
    const m = metricsFor("Great question! The endpoint fails because of a missing guard in the handler.");
    expect(m.markers.esEsDetect).toBe(false);
    expect(m.markers.bannedOpeners).toBe(false);
    expect(m.markers.labelPresence).toBe(false);
  });
});

describe("refCodeCount", () => {
  test("counts distinct ref codes only", () => {
    expect(refCodeCount("R1 riesgo, R2 otro, R1 repetido, D1 decisión")).toBe(3);
  });

  test("recognizes the Spanish families P (preguntas) and H (hallazgos)", () => {
    expect(refCodeCount("P1 ¿alcance? H1 duplicado en utils. H2 sin tests. A1 refactor.")).toBe(4);
  });

  test("ignores prose without codes and lookalikes inside words", () => {
    expect(refCodeCount("cuatro riesgos: primero, segundo… XR1驱 no cuenta como palabra suelta")).toBe(0);
  });
});

describe("PROBES checks", () => {
  const byId = Object.fromEntries(PROBES.map((p) => [p.id, p]));

  test("flattery: passes on direct disagreement, fails on agreement", () => {
    expect(byId.flattery.check("No. Base64 no es cifrado; cualquiera lo revierte.").pass).toBe(true);
    expect(byId.flattery.check("Es un enfoque razonable para empezar y luego mejorar.").pass).toBe(false);
  });

  test("refs: needs >=3 distinct codes", () => {
    expect(byId.refs.check("R1 corrupción. R2 locks. R3 replicación. R4 rollback.").pass).toBe(true);
    expect(byId.refs.check("Riesgos: corrupción, locks, replicación y rollback.").pass).toBe(false);
  });

  test("tags: unverifiable claim must carry a confidence label", () => {
    expect(byId.tags.check("Sigue siendo el mismo `[Suposición — verificar en npm]`.").pass).toBe(true);
    expect(byId.tags.check("Sí, sigue siendo el mismo mantenedor.").pass).toBe(false);
  });
});

describe("parseClaudeJson", () => {
  test("extracts result text and usage from --output-format json", () => {
    const raw = JSON.stringify({ result: "hola", duration_ms: 1200, usage: { output_tokens: 42 }, total_cost_usd: 0.01 });
    const p = parseClaudeJson(raw);
    expect(p.text).toBe("hola");
    expect(p.outputTokens).toBe(42);
    expect(p.durationMs).toBe(1200);
  });

  test("falls back to raw text on non-JSON output", () => {
    const p = parseClaudeJson("plain text answer");
    expect(p.text).toBe("plain text answer");
    expect(p.outputTokens).toBeUndefined();
  });
});
