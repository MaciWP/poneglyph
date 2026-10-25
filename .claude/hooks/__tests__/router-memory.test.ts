import { describe, expect, test } from "bun:test";
import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatPast, loadMemory, memoryFromTurns, memoryIsStale, sessionSkills, similarPast } from "../router/memory";

const catalog = new Set(["dev-workflow", "pr-review", "work:team-lessons"]);
const turn = (text: string, at: number, named: string[] = [], called: string[] = []) => ({ text, at, named, called });

describe("router memory: entries", () => {
  test("keeps prompts with a typed or called skill, strips the invocation and drops duplicates", () => {
    const entries = memoryFromTurns([
      turn("revisa la pr de la rama de exportación con /pr-review por favor", 1, ["pr-review"]),
      turn("arregla el bug del login cuando el token caduca y añade su test", 2, [], ["dev-workflow"]),
      turn("arregla el bug del login cuando el token caduca y añade su test", 3, [], ["dev-workflow"]),
      turn("me parece bien lo que propones, sigue con el siguiente paso", 4),
      turn("usa /clear y luego cuéntame qué tal ha ido todo el día", 5, ["clear"]),
    ], catalog);
    expect(entries).toEqual([
      { at: 1, prompt: "revisa la pr de la rama de exportación por favor", skills: ["pr-review"] },
      { at: 2, prompt: "arregla el bug del login cuando el token caduca y añade su test", skills: ["dev-workflow"] },
    ]);
  });

  test("does not learn from calls the router or the keyword hook suggested, or made after the turn's first edit", () => {
    const routed = { ...turn("arregla el bug del login cuando el token caduca y añade su test", 1, [], ["dev-workflow"]), routed: ["dev-workflow"] };
    const hinted = { ...turn("planifica la migración de la base de datos de clientes ya", 2, [], ["dev-workflow"]), hinted: ["dev-workflow"] };
    const typed = { ...turn("revisa la pr de la rama de exportación con /pr-review por favor", 3, ["pr-review"]), routed: ["pr-review"] };
    const late = { ...turn("busca la documentación del despliegue y resume lo que falta", 4, [], ["dev-workflow"]), late: ["dev-workflow"] };
    expect(memoryFromTurns([routed, hinted, typed, late], catalog).map((e) => e.skills)).toEqual([["pr-review"]]);
  });

  test("keeps a skill the router suggested and the Lead turned down, unless it was loaded then or soon after", () => {
    const T = Date.parse("2026-10-01T10:00:00Z"), H = 3_600_000;
    const declined = (text: string, at: number, called: string[] = []) => ({ ...turn(text, at, [], called), routed: ["pr-review"], answers: [{ name: "pr-review", yes: false }, { name: "ghost", yes: false }] });
    expect(memoryFromTurns([
      declined("investiga en los logs locales por qué falla el arranque", T),
      declined("revisa el diff de la rama nueva antes de mergear hoy", T + H, ["dev-workflow"]),
      turn("vale, al final revisa la pr de esta rama con calma", T + 2.5 * H, [], ["pr-review"]),
      declined("mira qué hace la función de exportación del listado", T + 5 * H),
    ], catalog)).toEqual([
      { at: T, prompt: "investiga en los logs locales por qué falla el arranque", skills: [], declined: ["pr-review"] },
      { at: T + H, prompt: "revisa el diff de la rama nueva antes de mergear hoy", skills: ["dev-workflow"] },
      { at: T + 2.5 * H, prompt: "vale, al final revisa la pr de esta rama con calma", skills: ["pr-review"] },
      { at: T + 5 * H, prompt: "mira qué hace la función de exportación del listado", skills: [], declined: ["pr-review"] },
    ]);
  });

  test("drops pasted blocks and caps the text", () => {
    const long = `mira este ticket <pasted_content id="1">${"secreto ".repeat(50)}</pasted_content> y planifica el cambio ${"x".repeat(400)}`;
    const [e] = memoryFromTurns([turn(long, 1, [], ["dev-workflow"])], catalog);
    expect(e.prompt).not.toContain("secreto");
    expect(e.prompt.length).toBe(300);
  });

  test("loads the index and skips invalid lines", () => {
    const file = join(mkdtempSync(join(tmpdir(), "router-mem-")), "m.jsonl");
    writeFileSync(file, `${JSON.stringify({ at: 1, prompt: "p", skills: ["a"] })}\n{bad\n${JSON.stringify({ prompt: "no at" })}\n`);
    expect(loadMemory(file)).toEqual([{ at: 1, prompt: "p", skills: ["a"] }]);
    expect(loadMemory(file + ".missing")).toEqual([]);
  });

  test("is stale when missing or older than the refresh age", () => {
    const file = join(mkdtempSync(join(tmpdir(), "router-mem-")), "m.jsonl");
    expect(memoryIsStale(file)).toBe(true);
    writeFileSync(file, "");
    expect(memoryIsStale(file)).toBe(false);
    const old = (Date.now() - 7 * 3_600_000) / 1000;
    utimesSync(file, old, old);
    expect(memoryIsStale(file)).toBe(true);
  });
});

describe("router memory: retrieval", () => {
  const memory = [
    { at: 1, prompt: "revisa la pr de exportación csv y deja comentarios", skills: ["pr-review"] },
    { at: 2, prompt: "arregla el login cuando caduca el token de sesión", skills: ["dev-workflow"] },
    { at: 3, prompt: "planifica la migración de la base de datos de clientes", skills: ["dev-workflow"] },
  ];

  test("ranks the closest past prompt first and needs two shared words", () => {
    expect(similarPast("el login falla cuando caduca el token, arréglalo", memory).map((e) => e.at)).toEqual([2]);
    expect(similarPast("revisa la pr nueva de exportación", memory)[0].at).toBe(1);
    expect(similarPast("qué tal el login", memory)).toEqual([]);
    expect(similarPast("", memory)).toEqual([]);
  });

  test("formats the block the router reads, or nothing", () => {
    expect(formatPast([])).toBe("");
    expect(formatPast([{ at: 1, prompt: 'di "hola"', skills: ["a", "b"] }])).toBe("<past>\n- \"di 'hola'\" → a, b\n</past>");
    expect(formatPast([{ at: 1, prompt: "p", skills: ["a"], declined: ["c"] }, { at: 2, prompt: "q", skills: [], declined: ["c", "d"] }])).toBe("<past>\n- \"p\" → a · declined: c\n- \"q\" → declined: c, d\n</past>");
  });
});

describe("router memory: session skills", () => {
  test("collects skills the user named and the model called in this session", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "router-mem-")), "t.jsonl");
    writeFileSync(file, [
      { type: "user", message: { content: "revisa esto con /pr-review y luego seguimos" } },
      { type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "dev-workflow" } }] } },
      { type: "assistant", isSidechain: true, message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "subagent-only" } }] } },
    ].map((o) => JSON.stringify(o)).join("\n"));
    expect([...await sessionSkills(file)].sort()).toEqual(["dev-workflow", "pr-review"]);
    expect((await sessionSkills(undefined)).size).toBe(0);
    expect((await sessionSkills(file + ".missing")).size).toBe(0);
  });
});
