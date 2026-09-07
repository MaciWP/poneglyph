import { describe, test, expect } from "bun:test";
import {
  bannedOpeners,
  esEsDetect,
  blufPosition,
  labelPresence,
  skillTriggerParse,
  calqueDetect,
  devLoopStages,
  graders,
} from "../graders";
import { runOffline } from "../run";
import { join } from "node:path";

const FIXTURES = join(import.meta.dir, "fixtures");

describe("bannedOpeners (T3.1-T3.3)", () => {
  test("T3.1 fails on sycophantic opener and names the phrase", () => {
    const r = bannedOpeners("¡Buena pregunta! Aquí va la respuesta sobre el hook.");
    expect(r.pass).toBe(false);
    expect(r.detail.toLowerCase()).toContain("buena pregunta");
  });

  test("T3.2 passes on direct BLUF answer", () => {
    const r = bannedOpeners("El endpoint falla por un guard ausente. Fix: añadir la comprobación en auth.ts:23.");
    expect(r.pass).toBe(true);
  });

  test("T3.3 literal-quote exception: phrase inside quotes is exempt", () => {
    const r = bannedOpeners('La regla dice: nunca abrir con "buena pregunta" ni variantes.');
    expect(r.pass).toBe(true);
  });
});

describe("esEsDetect (T3.4-T3.5)", () => {
  test("T3.4 passes on Spanish prose, fails on English prose", () => {
    const es = esEsDetect("La validación falla porque el fichero no existe y la ruta está mal construida desde el principio.");
    expect(es.pass).toBe(true);
    const en = esEsDetect("The validation fails because the file does not exist and the path is wrongly constructed from the start.");
    expect(en.pass).toBe(false);
    expect(en.detail.length).toBeGreaterThan(0);
  });

  test("T3.5 fenced + inline code stripped before detection", () => {
    const mixed = [
      "La función corregida queda así y pasa la suite entera:",
      "```typescript",
      "export function loadSkills(dirs: string[]): Skill[] {",
      "  // the loader walks every directory and parses the frontmatter",
      "  return dirs.flatMap((d) => parseFrontmatterFiles(d));",
      "}",
      "```",
      "Con esto el hook vuelve a registrar la skill y `loadSkills` devuelve la lista completa.",
    ].join("\n");
    expect(esEsDetect(mixed).pass).toBe(true);
  });
});

describe("blufPosition (T3.6)", () => {
  test("answer-first passes", () => {
    const r = blufPosition("El config rompe en la línea 23: falta el guard. Abajo va el fix con su test.");
    expect(r.pass).toBe(true);
  });

  test("preamble-first fails with position detail", () => {
    const r = blufPosition(
      "Primero voy a explicar el contexto del sistema para que se entienda el problema.\n\nDespués de revisar todo, la respuesta es que falta el guard en la línea 23.",
    );
    expect(r.pass).toBe(false);
    expect(r.detail.length).toBeGreaterThan(0);
  });
});

describe("labelPresence (T3.7)", () => {
  test("label with payload passes", () => {
    const r = labelPresence(
      "El endpoint devuelve 200 [Probable — based on the handler signature; flips if middleware rewrites it].",
      { expected: "payload-required" },
    );
    expect(r.pass).toBe(true);
  });

  test("bare label fails when payload required", () => {
    const r = labelPresence("El endpoint devuelve 200 [Probable].", { expected: "payload-required" });
    expect(r.pass).toBe(false);
    expect(r.detail).toContain("payload");
  });

  test("label wrapped in inline backticks is found (spec writes labels in backticks)", () => {
    const r = labelPresence(
      "No puedo saberlo sin comprobarlo `[Suposición — verificar en el handler de auth]`.",
      { expected: "payload-required" },
    );
    expect(r.pass).toBe(true);
  });

  test("a label illustrated inside a fenced code block does NOT count as a real label", () => {
    const r = labelPresence("```\n[Probable — ejemplo dentro de código]\n```\nTexto sin label real.", {
      expected: "payload-required",
    });
    expect(r.pass).toBe(false);
  });
});

describe("skillTriggerParse (T3.8-T3.9)", () => {
  const skillEvent = JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "scope" } }] },
  });
  const textEvent = JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "text", text: "hola" }] },
  });

  test("T3.8 detects Skill() invocation; fails when absent", () => {
    expect(skillTriggerParse([textEvent, skillEvent].join("\n"), { expected: "scope" }).pass).toBe(true);
    const miss = skillTriggerParse(textEvent, { expected: "scope" });
    expect(miss.pass).toBe(false);
    expect(miss.detail).toContain("scope");
  });

  test("T3.9 malformed JSONL line tolerated", () => {
    const corrupt = ["{not json at all", skillEvent].join("\n");
    expect(skillTriggerParse(corrupt, { expected: "scope" }).pass).toBe(true);
  });
});

describe("calqueDetect (T2.1-T2.5)", () => {
  test("T2.1 fails on calque and names it", () => {
    const r = calqueDetect("Esto hace sentido porque el hook ya existe.");
    expect(r.pass).toBe(false);
    expect(r.detail.toLowerCase()).toContain("hace sentido");
  });

  test("T2.2 passes on clean es-ES prose", () => {
    const r = calqueDetect("Tiene lógica porque el hook ya existe. Actualizo la configuración.");
    expect(r.pass).toBe(true);
  });

  test("T2.3 literal-quote exception: calque inside quotes is exempt", () => {
    const r = calqueDetect('El usuario escribió "voy a proceder a borrarlo" pero no lo hizo.');
    expect(r.pass).toBe(true);
  });

  test("T2.4 fenced-code exception: calque inside a code block is exempt", () => {
    const r = calqueDetect("```\n// es debido a que\n```\nTexto limpio sin calques.");
    expect(r.pass).toBe(true);
  });

  test("T2.5 registered in graders map", () => {
    expect(typeof graders["calqueDetect"]).toBe("function");
  });
});

describe("runOffline (T3.10)", () => {
  test("grades stored fixtures: 1 pass + 1 fail → aggregate reflects both", async () => {
    const report = await runOffline(join(FIXTURES, "cases.jsonl"), FIXTURES);
    expect(report.results.length).toBe(2);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.ok).toBe(false);
  });
});

describe("devLoopStages (029 US-dev)", () => {
  test("passes stages-visible when PLAN-stage signals are in prose", () => {
    const r = devLoopStages(
      "Objetivo: añadir paginación al listado. Asunciones: (1) el dataset cabe en memoria. Riesgos: los consumidores parsean stdout. Plan: tocar report.ts y sus tests.",
      { expected: "stages-visible" },
    );
    expect(r.pass).toBe(true);
  });

  test("fails stages-visible when the reply jumps straight to code", () => {
    const r = devLoopStages(
      "Hecho — he añadido la función y actualizado el test.\n```ts\nconst plan = paginate(items);\n```",
      { expected: "stages-visible" },
    );
    expect(r.pass).toBe(false);
  });

  test("passes no-ceremony on a proportional trivial reply", () => {
    const r = devLoopStages("Corregido el typo en README.md línea 12.", { expected: "no-ceremony" });
    expect(r.pass).toBe(true);
  });

  test("fails no-ceremony when a trivial task gets the full block", () => {
    const r = devLoopStages(
      "Objetivo: corregir el typo. Asunciones: ninguna. Riesgos: ninguno. Plan: editar README.",
      { expected: "no-ceremony" },
    );
    expect(r.pass).toBe(false);
  });

  test("code fences never poison the signal count", () => {
    const r = devLoopStages(
      "Listo.\n```py\nrisk = plan.goal(assumption)\n```",
      { expected: "no-ceremony" },
    );
    expect(r.pass).toBe(true);
  });
});
