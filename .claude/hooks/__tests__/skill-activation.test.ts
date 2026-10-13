import { describe, test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isNonHumanPayload, detectFeatureShape, analyzePayload, foldText, clearHint, CLEAR_HINT_TOKENS } from "../skill-activation";
import { formatLogLine } from "../instructions-loaded";

const hint = (prompt: string) => analyzePayload(JSON.stringify({ prompt }));

// Skill discovery belongs to the prompt router. The keyword hint measured hit 0.07
// and still fired false positives; this locks its removal so it does not creep back.
describe("no skill hints: the prompt router names skills", () => {
  test.each([
    "revisa la pr antes de aprobarla",
    "pregúntame todo sobre este plan de migración",
    "refactoriza el módulo de pagos aplicando principios SOLID",
    "Implement the plan",
  ])("%p emits no Skill() line", (prompt) => {
    expect(hint(prompt).injection).not.toContain("Skill(");
  });
});

describe("pre-gate: payloads no humanos", () => {
  test("isNonHumanPayload reconoce los 4 prefijos", () => {
    expect(isNonHumanPayload("[SYSTEM NOTIFICATION - NOT USER INPUT] lo que sea")).toBe(true);
    expect(isNonHumanPayload("<task-notification>resultado</task-notification>")).toBe(true);
    expect(isNonHumanPayload("  <system-reminder>recordatorio</system-reminder>")).toBe(true);
    expect(isNonHumanPayload("Caveat: the messages below were generated...")).toBe(true);
    expect(isNonHumanPayload("revisa la pr antes de aprobarla")).toBe(false);
  });

  test("una mención a mitad de frase NO activa el gate (solo prefijo)", () => {
    expect(isNonHumanPayload("el fichero contiene <system-reminder> como texto")).toBe(false);
  });

  test("analyzePayload calla ante un task-notification aunque su texto tenga forma de feature", () => {
    expect(hint("[SYSTEM NOTIFICATION - NOT USER INPUT] desarrolla una nueva funcionalidad").injection).toBe("");
  });
});

describe("analyzePayload: malformed payload is silent (T12.3)", () => {
  test("invalid JSON produces empty output without throwing", () => {
    expect(analyzePayload("{not json").injection).toBe("");
  });

  test("empty input produces empty output", () => {
    expect(analyzePayload("").injection).toBe("");
  });

  test("payload without prompt produces empty output", () => {
    expect(analyzePayload(JSON.stringify({ session_id: "x" })).injection).toBe("");
  });

  test("slash commands are skipped, '/goal <task>' is processed", () => {
    expect(hint("/flow-lifecycle desarrolla una nueva funcionalidad").injection).toBe("");
    expect(hint("/expert-role security").injection).toBe("");
    expect(hint("/goal desarrolla una nueva funcionalidad de informes").flowHint).toBe(true);
  });

  test("a plain prompt with no shape stays silent", () => {
    expect(hint("explícame cómo funciona la autenticación del proyecto por dentro").injection).toBe("");
    expect(hint("gracias").injection).toBe("");
  });
});

describe("foldText", () => {
  test("strips case and accents", () => {
    expect(foldText("Revisión TÉCNICA")).toBe("revision tecnica");
  });
});

describe("instructions-loaded: formatLogLine", () => {
  test("well-formed payload produces a line with type, reason and path", () => {
    const line = formatLogLine({
      session_id: "s1",
      file_path: "/x/CLAUDE.md",
      memory_type: "Project",
      load_reason: "session_start",
    });
    expect(line).toContain("Project");
    expect(line).toContain("session_start");
    expect(line).toContain("/x/CLAUDE.md");
  });

  test("payload without file_path returns null", () => {
    expect(formatLogLine({ session_id: "s1" })).toBeNull();
  });
});

describe("feature-shape flow hint", () => {
  test("detects feature-shaped prompts", () => {
    expect(detectFeatureShape("quiero desarrollar una nueva funcionalidad de notificaciones")).toBe(true);
    expect(detectFeatureShape("nueva feature de informes de proceso")).toBe(true);
    expect(detectFeatureShape("hazlo de principio a fin con todas las fases")).toBe(true);
  });

  test("stays silent on non-feature prompts", () => {
    expect(detectFeatureShape("corrige el typo del README")).toBe(false);
    expect(detectFeatureShape("revisa este ticket y dime qué pide")).toBe(false);
  });

  test("feature shape injects the /flow-lifecycle line, with the tiered ceiling", () => {
    const r = hint("desarrolla una nueva funcionalidad de exportación a excel");
    expect(r.flowHint).toBe(true);
    expect(r.injection).toContain("<skill-activation-hint>");
    expect(r.injection).toContain("/flow-lifecycle");
    expect(r.injection).toContain("/autocompact 400k");
  });

  test("no feature shape → no /flow-lifecycle line", () => {
    const r = hint("valida este plan antes de cerrarlo");
    expect(r.flowHint).toBe(false);
    expect(r.injection).not.toContain("/flow-lifecycle");
  });
});

describe("model/effort routing hint (shape-only, playbook §4)", () => {
  test("bulk/mechanical shape gets the routing line, marked shape-only", () => {
    const r = hint("barre todos los ficheros del repo y renombra el import en masa");
    expect(r.routingHint).toBe(true);
    expect(r.injection).toContain("/model");
    expect(r.injection.toLowerCase()).toContain("shape-only");
  });

  test("quick-lookup shape also routes cheap", () => {
    expect(hint("pregunta rapida: que hace este flag de git?").routingHint).toBe(true);
  });

  test("normal prompts get zero routing mentions (anti-ceremonia)", () => {
    const r = hint("valida este plan antes de cerrarlo");
    expect(r.routingHint).toBe(false);
    expect(r.injection).not.toContain("/model");
  });

  test("feature and routing shapes share one block", () => {
    const r = hint("barre todos los ficheros para esta nueva funcionalidad");
    expect(r.injection.match(/<skill-activation-hint>/g)).toHaveLength(1);
    expect(r.injection).toContain("/flow-lifecycle");
    expect(r.injection).toContain("/model");
  });
});

describe("/clear proposal once the session context passes CLEAR_HINT_TOKENS", () => {
  const transcript = (context: number) => {
    const file = join(mkdtempSync(join(tmpdir(), "clear-hint-")), "lead.jsonl");
    const usage = { input_tokens: 2, cache_read_input_tokens: context - 2, cache_creation_input_tokens: 0 };
    writeFileSync(file, [
      JSON.stringify({ type: "assistant", message: { model: "claude-opus-5-5", usage } }),
      JSON.stringify({ type: "assistant", message: { model: "<synthetic>", usage: { input_tokens: 0 } } }),
    ].join("\n") + "\n");
    return file;
  };
  const hint = (prompt: string, context: number) => clearHint(JSON.stringify({ prompt, transcript_path: transcript(context) }));

  test("fires at the threshold with the rounded size, and stays silent below it", () => {
    expect(hint("ahora revisa el módulo de facturas", CLEAR_HINT_TOKENS)?.line).toContain("~100k tokens");
    expect(hint("ahora revisa el módulo de facturas", 182_400)?.line).toContain("/clear");
    expect(hint("ahora revisa el módulo de facturas", CLEAR_HINT_TOKENS - 1)).toBeNull();
  });

  test("skips slash commands, system payloads and payloads without a readable transcript", () => {
    expect(hint("/compact keep the plan", 200_000)).toBeNull();
    expect(hint("<task-notification>done</task-notification>", 200_000)).toBeNull();
    expect(clearHint(JSON.stringify({ prompt: "revisa esto", transcript_path: "/nonexistent/lead.jsonl" }))).toBeNull();
    expect(clearHint("not json")).toBeNull();
  });
});
