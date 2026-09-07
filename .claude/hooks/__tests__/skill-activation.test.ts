import { describe, test, expect } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSkills,
  matchWithReasons,
  buildShortlistInjection,
  isNonHumanPayload,
  detectFeatureShape,
  analyzePayload,
  appendHintLog,
} from "../skill-activation";
import { formatLogLine } from "../instructions-loaded";

// Fixture: a minimal skills dir with one drillme-like skill (keywords on disk,
// no hardcoded list — mirrors the production loader contract).
const fixtures = mkdtempSync(join(tmpdir(), "skills-fixture-"));
mkdirSync(join(fixtures, "drillme"), { recursive: true });
writeFileSync(
  join(fixtures, "drillme", "SKILL.md"),
  [
    "---",
    "name: drillme",
    "description: |",
    "  Socratic check for plans and decisions.",
    "  Keywords - drill, drillme, socratic, valida, cuestiona, challenge, gap, gaps",
    "---",
    "",
    "# drillme",
  ].join("\n"),
);
for (const [name, kw] of [
  ["review-patterns", "refactor, solid, performance, slow, endpoint"],
  ["tdd-design", "tests, tdd, oracle, test-design"],
  ["skill-advisor", "skill-advisor, skills, shortlist, propón skills, which skills"],
  ["critic", "critic, revisa, audita, valida, verdict, revisa el codigo"],
] as const) {
  mkdirSync(join(fixtures, name), { recursive: true });
  writeFileSync(
    join(fixtures, name, "SKILL.md"),
    ["---", `name: ${name}`, "description: |", `  ${name} fixture.`, `  Keywords - ${kw}`, "---", "", `# ${name}`].join("\n"),
  );
}
// Multi-line Keywords block (SK-01): continuation lines indented inside
// `description: |`, terminated by the next top-level frontmatter key.
mkdirSync(join(fixtures, "wrapped-kw"), { recursive: true });
writeFileSync(
  join(fixtures, "wrapped-kw", "SKILL.md"),
  [
    "---",
    "name: wrapped-kw",
    "description: |",
    "  Fixture with wrapped keywords.",
    "  Keywords - primero, segundo,",
    "  continuación, tercera-línea, wrapped-match,",
    '  último - "frase de ejemplo entre comillas"',
    "disable-model-invocation: false",
    "---",
    "",
    "# wrapped-kw",
  ].join("\n"),
);
// Multi-word keyword wrapping WITHOUT a trailing comma (the real bug behind
// "review"→pr-conventional-comments, audit 2026-08-07): "review\ncomment" is
// ONE keyword "review comment", not two single-words.
mkdirSync(join(fixtures, "wrapped-multiword"), { recursive: true });
writeFileSync(
  join(fixtures, "wrapped-multiword", "SKILL.md"),
  [
    "---",
    "name: wrapped-multiword",
    "description: |",
    "  Fixture replicating pr-conventional-comments' wrapped keyword.",
    "  Keywords - conventional comments, review",
    "  comment, blocking",
    "---",
    "",
    "# wrapped-multiword",
  ].join("\n"),
);

const skills = loadSkills([fixtures]);

describe("loadSkills — multi-line Keywords block (SK-01)", () => {
  const wrapped = skills.find((s) => s.name === "wrapped-kw");
  test("continuation-line keywords are parsed, next YAML key is not swallowed", () => {
    expect(wrapped).toBeDefined();
    expect(wrapped!.keywords).toContain("continuación");
    expect(wrapped!.keywords).toContain("wrapped-match");
    expect(wrapped!.keywords).toContain("frase de ejemplo entre comillas");
    expect(wrapped!.keywords.some((k) => k.includes("disable-model-invocation"))).toBe(false);
  });
  test("a continuation-line multi-word keyword matches a prompt", () => {
    const names = matchWithReasons("dame la frase de ejemplo entre comillas aquí", skills).map((m) => m.name);
    expect(names).toContain("wrapped-kw");
  });
});

describe("loadSkills — multi-word keyword wrapping without comma (audit 2026-08-07)", () => {
  const skill = skills.find((s) => s.name === "wrapped-multiword");
  test("'review\\ncomment' joins into ONE keyword 'review comment'", () => {
    expect(skill).toBeDefined();
    expect(skill!.keywords).toContain("review comment");
    expect(skill!.keywords).not.toContain("review");
    expect(skill!.keywords).not.toContain("comment");
  });
  test("bare 'review' in a prompt no longer matches (the measured FP)", () => {
    const names = matchWithReasons("haz un review de esto", skills).map((m) => m.name);
    expect(names).not.toContain("wrapped-multiword");
  });
  test("the full phrase 'review comment' does match", () => {
    const names = matchWithReasons("deja un review comment en la pr", skills).map((m) => m.name);
    expect(names).toContain("wrapped-multiword");
  });
});

describe("matchWithReasons + buildShortlistInjection — prompt with match (T12.1)", () => {
  test("'valida y cuestiona este plan' (2 distinct hits) injects Skill(drillme) in ≤5 lines", () => {
    const injection = buildShortlistInjection(matchWithReasons("valida y cuestiona este plan", skills));
    expect(injection).toContain("Skill(drillme)");
    expect(injection.split("\n").length).toBeLessThanOrEqual(5);
  });
});

describe("matchWithReasons — prompt without match (T12.2)", () => {
  test("greeting matches nothing", () => {
    expect(matchWithReasons("hola buenos días", skills)).toEqual([]);
  });

  test("a single single-word hit no longer qualifies (precision rule)", () => {
    expect(matchWithReasons("valida este plan", skills)).toEqual([]);
  });

  test("buildShortlistInjection of empty list is empty string", () => {
    expect(buildShortlistInjection([])).toBe("");
  });
});

describe("keyword precision rule (auditoría 2026-08-07)", () => {
  test("fixture obligatorio: 'revisa los tests que ya existen' → silencio total", () => {
    const raw = JSON.stringify({ prompt: "en este caso, antes de continuar, revisa los tests que ya existen" });
    expect(analyzePayload(raw, skills).injection).toBe("");
  });

  test("'revisa y valida este resultado' → critic (2 distinct single-word hits)", () => {
    const names = matchWithReasons("revisa y valida este resultado, dame el verdict", skills).map((m) => m.name);
    expect(names).toContain("critic");
  });

  test("multi-word keyword alone qualifies: 'revisa el codigo'", () => {
    const matched = matchWithReasons("por favor revisa el codigo antes de aprobar", skills);
    expect(matched.map((m) => m.name)).toContain("critic");
    const critic = matched.find((m) => m.name === "critic")!;
    expect(critic.reason).toBe("revisa el codigo");
  });

  test("containment collapse: 'gap'+'gaps' from one physical word = 1 hit → no match", () => {
    expect(matchWithReasons("hay varios gaps que resolver", skills).map((m) => m.name)).not.toContain("drillme");
  });

  test("tradeoff documentado: el nombre corto solo ('drillme' ⊃ 'drill') ya no basta", () => {
    expect(matchWithReasons("necesito un drillme de esto", skills).map((m) => m.name)).not.toContain("drillme");
  });
});

describe("pre-gate — payloads no humanos (auditoría 2026-08-07)", () => {
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

  test("analyzePayload calla ante un task-notification aunque su texto matchee keywords", () => {
    const raw = JSON.stringify({
      prompt: "[SYSTEM NOTIFICATION - NOT USER INPUT] revisa y valida el resultado, cuestiona el plan",
    });
    expect(analyzePayload(raw, skills).injection).toBe("");
  });

  test("el pre-gate no toca disco (getter no invocado)", () => {
    let calls = 0;
    const getter = () => {
      calls++;
      return skills;
    };
    analyzePayload(JSON.stringify({ prompt: "<system-reminder>revisa y valida</system-reminder>" }), getter);
    expect(calls).toBe(0);
  });
});

describe("analyzePayload — malformed payload is silent (T12.3)", () => {
  test("invalid JSON produces empty output without throwing", () => {
    expect(analyzePayload("{not json", skills).injection).toBe("");
  });

  test("empty input produces empty output", () => {
    expect(analyzePayload("", skills).injection).toBe("");
  });

  test("payload without prompt produces empty output", () => {
    expect(analyzePayload(JSON.stringify({ session_id: "x" }), skills).injection).toBe("");
  });

  test("slash-command prompt is skipped (user already chose)", () => {
    expect(analyzePayload(JSON.stringify({ prompt: "/drillme algo" }), skills).injection).toBe("");
  });

  test("/flow is skipped — it self-routes its phase skills", () => {
    expect(analyzePayload(JSON.stringify({ prompt: "/flow valida este plan" }), skills).injection).toBe("");
  });
});

describe("analyzePayload — silencioso por defecto (031)", () => {
  test("T2.1 match real → shortlist con motivo, SIN línea advisor incondicional", () => {
    const out = analyzePayload(
      JSON.stringify({ prompt: "refactoriza el módulo de pagos aplicando SOLID" }),
      skills,
    ).injection;
    expect(out).toContain("Skill(review-patterns)");
    expect(out).toContain("matched");
    expect(out).not.toContain("Skill(skill-advisor)");
  });

  test("T2.2 prompt no-trivial SIN match ni shape → silencio total", () => {
    const out = analyzePayload(
      JSON.stringify({ prompt: "explícame cómo funciona la autenticación del proyecto por dentro" }),
      skills,
    ).injection;
    expect(out).toBe("");
  });

  test("T2.2b '/goal' se procesa: con match emite hint, sin match calla", () => {
    const conMatch = analyzePayload(
      JSON.stringify({ prompt: "/goal valida y cuestiona este plan de migración" }),
      skills,
    ).injection;
    expect(conMatch).toContain("Skill(drillme)");
    const sinMatch = analyzePayload(
      JSON.stringify({ prompt: "/goal añade un botón al formulario de login" }),
      skills,
    ).injection;
    expect(sinMatch).toBe("");
  });

  test("T2.3 '/flow' y '/role' siguen saltándose", () => {
    expect(analyzePayload(JSON.stringify({ prompt: "/flow valida este plan" }), skills).injection).toBe("");
    expect(analyzePayload(JSON.stringify({ prompt: "/role security" }), skills).injection).toBe("");
  });

  test("T2.4 prompt trivial → vacío (sin ruido)", () => {
    expect(analyzePayload(JSON.stringify({ prompt: "gracias" }), skills).injection).toBe("");
  });

  test("T2.5 presupuesto de líneas respetado (≤5, ya sin línea advisor)", () => {
    const out = analyzePayload(
      JSON.stringify({ prompt: "refactor solid performance slow endpoint tests tdd" }),
      skills,
    ).injection;
    expect(out.split("\n").length).toBeLessThanOrEqual(5);
    expect(out).not.toContain("Skill(skill-advisor)");
  });

  test("T2.6 carga perezosa: los pre-gates no tocan disco (getter no invocado)", () => {
    let calls = 0;
    const getter = () => {
      calls++;
      return skills;
    };
    expect(analyzePayload(JSON.stringify({ prompt: "/flow valida" }), getter).injection).toBe("");
    expect(analyzePayload("", getter).injection).toBe("");
    expect(analyzePayload("{not json", getter).injection).toBe("");
    expect(calls).toBe(0);
    analyzePayload(JSON.stringify({ prompt: "valida este plan" }), getter);
    expect(calls).toBe(1);
  });
});

describe("instructions-loaded — formatLogLine", () => {
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

describe("feature-shape flow hint (029/US13)", () => {
  test("detects feature-shaped prompts", () => {
    expect(detectFeatureShape("quiero desarrollar una nueva funcionalidad de notificaciones")).toBe(true);
    expect(detectFeatureShape("nueva feature de informes de proceso")).toBe(true);
    expect(detectFeatureShape("hazlo de principio a fin con todas las fases")).toBe(true);
  });

  test("stays silent on non-feature prompts", () => {
    expect(detectFeatureShape("corrige el typo del README")).toBe(false);
    expect(detectFeatureShape("revisa este ticket y dime qué pide")).toBe(false);
  });

  test("analyzePayload adds the /flow line on feature shape, alongside matched skills", () => {
    const raw = JSON.stringify({ prompt: "valida el plan de esta nueva funcionalidad de informes" });
    const r = analyzePayload(raw, skills);
    expect(r.flowHint).toBe(true);
    expect(r.injection).toContain("/flow");
    expect(r.injection).toContain("skill-activation-hint");
  });

  test("feature shape alone (no skill keyword match) still injects the /flow line", () => {
    const raw = JSON.stringify({ prompt: "desarrolla una nueva funcionalidad de exportación a excel" });
    const r = analyzePayload(raw, skills);
    expect(r.flowHint).toBe(true);
    expect(r.injection).toContain("/flow");
  });

  test("no feature shape → no /flow line (unchanged behavior)", () => {
    const raw = JSON.stringify({ prompt: "valida este plan antes de cerrarlo" });
    const r = analyzePayload(raw, skills);
    expect(r.flowHint).toBe(false);
    expect(r.injection).not.toContain("/flow");
  });
});

describe("hint emission log (029/US13 — honor-rate measurement, emit side)", () => {
  test("appends a JSON line with reasons under .claude/learned/skill-hints.log", () => {
    const dir = mkdtempSync(join(tmpdir(), "hintlog-"));
    const ok = appendHintLog(dir, {
      ts: "2026-08-05T00:00:00Z",
      skills: ["drillme"],
      reasons: ["valida y cuestiona"],
      flow: false,
    });
    expect(ok).toBe(true);
    const written = readFileSync(join(dir, ".claude", "learned", "skill-hints.log"), "utf8");
    const entry = JSON.parse(written.trim().split("\n").at(-1)!);
    expect(entry.skills).toEqual(["drillme"]);
    expect(entry.reasons).toEqual(["valida y cuestiona"]);
    expect(entry.flow).toBe(false);
  });

  test("fail-silent on unwritable destination — never throws (hook contract)", () => {
    // A path UNDER a regular file cannot be mkdir'd on any OS. ("/dev/null/nope"
    // was the old fixture — on Windows it resolves to D:\dev\null\nope and the
    // mkdir SUCCEEDS, leaving litter on the drive; audit 010.)
    const blocker = join(mkdtempSync(join(tmpdir(), "hintlog-")), "not-a-dir");
    writeFileSync(blocker, "x");
    let ok = true;
    expect(() => {
      ok = appendHintLog(join(blocker, "nope"), { ts: "t", skills: [], reasons: [], flow: false });
    }).not.toThrow();
    expect(ok).toBe(false);
  });

  test("analyzePayload devuelve reasons alineadas con skills", () => {
    const r = analyzePayload(JSON.stringify({ prompt: "revisa y valida el resultado, dame el verdict" }), skills);
    expect(r.skills).toContain("critic");
    expect(r.reasons.length).toBe(r.skills.length);
  });
});

describe("model/effort routing hint (029/US7 — shape-only, playbook §4)", () => {
  test("bulk/mechanical shape gets the routing line, marked shape-only", () => {
    const raw = JSON.stringify({ prompt: "barre todos los ficheros del repo y renombra el import en masa" });
    const r = analyzePayload(raw, skills);
    expect(r.routingHint).toBe(true);
    expect(r.injection).toContain("/model");
    expect(r.injection.toLowerCase()).toContain("shape-only");
  });

  test("quick-lookup shape also routes cheap", () => {
    const raw = JSON.stringify({ prompt: "pregunta rapida: que hace este flag de git?" });
    const r = analyzePayload(raw, skills);
    expect(r.routingHint).toBe(true);
  });

  test("normal prompts get zero routing mentions (anti-ceremonia, hereda AC4 de 027)", () => {
    const raw = JSON.stringify({ prompt: "valida este plan antes de cerrarlo" });
    const r = analyzePayload(raw, skills);
    expect(r.routingHint).toBe(false);
    expect(r.injection).not.toContain("/model");
  });
});
