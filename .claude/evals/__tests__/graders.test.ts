import { describe, test, expect } from "bun:test";
import {
  bannedOpeners,
  esEsDetect,
  blufPosition,
  labelPresence,
  skillTriggerParse,
  calqueDetect,
  devLoopStages,
  cardSeparators,
  proseLength,
  stepState,
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
  test("passes stages-visible when the five stage names are in prose", () => {
    const r = devLoopStages(
      "KNOW: report.ts ya pagina el listado. PLAN: reutilizar esa función. BUILD: hecho en dos líneas. REVIEW: suite verde. LEARN: nada no obvio.",
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
      "KNOW: es un typo. PLAN: editarlo. BUILD: hecho. REVIEW: nada que ejecutar. LEARN: nada.",
      { expected: "no-ceremony" },
    );
    expect(r.pass).toBe(false);
  });

  test("code fences never poison the signal count", () => {
    const r = devLoopStages(
      "Listo.\n```py\nplan = build(know, review, learn)\n```",
      { expected: "no-ceremony" },
    );
    expect(r.pass).toBe(true);
  });
});

// Quality review 2026-09-11 — H56: the behavioural replacement for two mandatory routing
// rows that no invocation counter can audit.
describe("evidenceBeforeDone", () => {
  test("passes a completion claim backed by an executed check", () => {
    expect(graders.evidenceBeforeDone("Hecho: la suite pasa 128/128.", { expected: "evidence-before-done" } as never).pass).toBe(true);
  });

  test("fails a bare completion claim", () => {
    expect(graders.evidenceBeforeDone("Hecho, ya funciona.", { expected: "evidence-before-done" } as never).pass).toBe(false);
  });

  test("passes an unverified existence claim that carries a tag", () => {
    expect(graders.evidenceBeforeDone("Existe formatDate [Suposición — no he leído el fichero].", { expected: "tagged-claim" } as never).pass).toBe(true);
  });

  test("fails an unverified existence claim stated flatly", () => {
    expect(graders.evidenceBeforeDone("Sí, formatDate existe en el proyecto.", { expected: "tagged-claim" } as never).pass).toBe(false);
  });
});

// Style-adherence graders added 2026-09-11 (review of the `i-have-adhd` skill).

describe("cardSeparators (H16 — §2 separators, previously ungraded)", () => {
  test("fails on labeled cards split by a box-drawing rule", () => {
    const r = cardSeparators(`Hallazgo H1 — media
El bucket S3 queda huérfano
────────────────────
Hallazgo H2 — baja
Falta el índice`);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain("separator");
  });

  test("fails on a bare markdown thematic break (it reads as a user interruption)", () => {
    const r = cardSeparators(`Primer bloque de la respuesta.

---

Segundo bloque de la respuesta.`);
    expect(r.pass).toBe(false);
  });

  test("fails on a box-drawn frame", () => {
    const r = cardSeparators(`┌──────────┬──────────┐
│ Fichero  │ Cambio   │
└──────────┴──────────┘`);
    expect(r.pass).toBe(false);
  });

  test("bare frontmatter outside a fence IS the failure, deliberately: it renders as that divider", () => {
    const r = cardSeparators(`El fichero empieza así:

---
name: Poneglyph
---

Y sigue el cuerpo.`);
    expect(r.pass).toBe(false);
  });

  test("the same frontmatter inside a fence passes — §2 wants quoted config fenced", () => {
    const r = cardSeparators(`El fichero empieza así:

\`\`\`yaml
---
name: Poneglyph
---
\`\`\`

Y sigue el cuerpo.`);
    expect(r.pass).toBe(true);
  });

  test("passes a markdown pipe table: its header rule starts with a pipe", () => {
    const r = cardSeparators(`| Fichero | Cambio |
|---|---|
| auth.ts | guard añadido |`);
    expect(r.pass).toBe(true);
  });
});

describe("proseLength (§4 ceiling on running prose)", () => {
  test("structure does not count: a long compliant table passes", () => {
    const rows = Array.from({ length: 30 }, (_, i) => `| H${i} | media | un hallazgo cualquiera |`);
    const r = proseLength(
      ["Los hallazgos ordenados por severidad:", "", "| Ref | Sev | Hallazgo |", "|---|---|---|", ...rows].join("\n"),
      { expected: "concise" },
    );
    expect(r.pass).toBe(true);
  });

  test("fails on a wall of running prose", () => {
    const wall = Array.from({ length: 25 }, (_, i) => `Esta es la línea ${i} de prosa corrida sin estructura ninguna.`);
    const r = proseLength(wall.join("\n"), { expected: "concise" });
    expect(r.pass).toBe(false);
    expect(r.detail).toMatch(/\d+/);
  });

  test("numbered steps and bullets are structure, not prose", () => {
    const steps = Array.from({ length: 20 }, (_, i) => `${i + 1}. Ejecuta el paso ${i + 1} del procedimiento.`);
    expect(proseLength(steps.join("\n"), { expected: "concise" }).pass).toBe(true);
  });

  test("only judges cases that ask for it", () => {
    const wall = Array.from({ length: 40 }, () => "Prosa corrida que se extiende sin necesidad.");
    expect(proseLength(wall.join("\n"), { expected: "explica" }).pass).toBe(true);
  });
});

describe("stepState (§2 — multi-step work without the dev-loop scan line)", () => {
  test("passes when the turn names the current step and the next one", () => {
    const r = stepState("Paso 3 de 5: esquema actualizado. Siguiente: backfill de la columna nueva.", { expected: "step-state" });
    expect(r.pass).toBe(true);
  });

  test("fails when progress is asserted without position", () => {
    const r = stepState("Hecho. ¿Seguimos con la siguiente parte?", { expected: "step-state" });
    expect(r.pass).toBe(false);
  });

  test("a lone status icon opening a verdict is not the scan line", () => {
    const r = stepState("🔴 Veredicto: no la instales. Ya está cubierta por el estilo de la casa.", { expected: "step-state" });
    expect(r.pass).toBe(false);
  });

  test("the dev-loop scan line also restores state and counts", () => {
    const r = stepState("🟢 KNOW · 🟢 PLAN · 🔵 BUILD · ⚪ REVIEW · ⚪ LEARN", { expected: "step-state" });
    expect(r.pass).toBe(true);
  });
});

describe("registry", () => {
  test("the three new graders are dispatchable by name from cases.jsonl", () => {
    expect(graders.cardSeparators).toBe(cardSeparators);
    expect(graders.proseLength).toBe(proseLength);
    expect(graders.stepState).toBe(stepState);
  });
});

// Quality review 2026-09-11 — H69. The grader passed on two PLAN-stage words while
// CLAUDE.md §The dev loop demands the five stages visible in the answer. It measured
// less than the rule it guards, so a reply that skipped BUILD, REVIEW and LEARN scored
// as compliant.
describe("devLoopStages grades the five stages the doctrine names (H69)", () => {
  test("a PLAN-only reply is not a visible dev loop", () => {
    const r = devLoopStages(
      "Objetivo: añadir paginación. Plan: tocar report.ts y sus tests.",
      { expected: "stages-visible" },
    );
    expect(r.pass).toBe(false);
  });

  test("the compact scan line counts as the five stages", () => {
    const r = devLoopStages(
      "🟢 KNOW · 🟢 PLAN · 🟢 BUILD · 🟢 REVIEW · 🟢 LEARN\n\nHecho.",
      { expected: "stages-visible" },
    );
    expect(r.pass).toBe(true);
  });

  test("four of five is still a missing stage", () => {
    const r = devLoopStages(
      "KNOW: leído. PLAN: claro. BUILD: hecho. REVIEW: suite verde.",
      { expected: "stages-visible" },
    );
    expect(r.pass).toBe(false);
  });
});
