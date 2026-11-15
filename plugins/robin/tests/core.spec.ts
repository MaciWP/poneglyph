import { expect, test } from "bun:test";
import { boxOf, check, contextLine, extractRobin, KEEP, languageOf, remember, streakFromLog, turnOf } from "../hooks/core.ts";

const ES = "He corregido la página y falta mirarla en el navegador, pero no hay errores en la consola.";
const EN = "I fixed the page and it is ready for review, but the console still has one warning that we should check.";
const ok = (body = ES) => `${body}\n\nROBIN: Página corregida; falta mirarla.`;
const fresh = { streak: 0, waiting: false, answered: true };

test("extractRobin takes only the last line outside code and quotes", () => {
  expect(extractRobin(ok())).toEqual({ text: "Página corregida; falta mirarla.", body: ES });
  expect(extractRobin("**ROBIN:** Hecho.")?.text).toBe("Hecho.");
  expect(extractRobin("Pasan.\n  ROBIN: Hecho.\n\n")?.text).toBe("Hecho.");
  expect(extractRobin("    ROBIN: bloque de código indentado")).toBeNull();
  expect(extractRobin("```\nROBIN: dentro\n```")).toBeNull();
  expect(extractRobin("> ROBIN: citado")).toBeNull();
  expect(extractRobin("ROBIN: arriba\n\nY luego más texto.")).toBeNull();
});

test("languageOf ignores code and needs 8 words before calling a text English", () => {
  expect(languageOf(ES).lang).toBe("es");
  expect(languageOf(EN).lang).toBe("en");
  expect(languageOf("The fix is ready.").lang).toBe("es");
  expect(languageOf("```ts\nconst the = this.is.for.the.with.from.that;\n```").lang).toBe("none");
  expect(languageOf("| Mod | Estado |\n|---|---|\n| `workboard` | 🟢 hecho, falta probar la sesión |").lang).toBe("es");
});

test("check: ok resets the streak, a miss counts, two in a row are lost", () => {
  expect(check(ok(), { ...fresh, streak: 1 })).toMatchObject({ verdict: "ok", streak: 0, fail: false, lost: false });
  const one = check(ES, fresh);
  expect(one).toMatchObject({ verdict: "miss", streak: 1, fail: true, lost: false });
  expect(check(ES, { ...fresh, streak: one.streak })).toMatchObject({ verdict: "miss", streak: 2, lost: true });
});

test("check: waiting and skipped turns never change the streak", () => {
  expect(check("Espero al agente.", { ...fresh, streak: 1, waiting: true })).toMatchObject({ verdict: "wait", streak: 1, fail: false });
  expect(check("No response requested.", { ...fresh, streak: 1 })).toMatchObject({ verdict: "skip", streak: 1 });
  expect(check("", { ...fresh, streak: 1 })).toMatchObject({ verdict: "skip", streak: 1 });
  expect(check(ES, { ...fresh, streak: 1, answered: false })).toMatchObject({ verdict: "skip", streak: 1 });
});

test("check: an English answer fails even with its ROBIN line", () => {
  expect(check(ok(EN), fresh)).toMatchObject({ verdict: "ok", lang: "en", fail: true, streak: 0 });
});

test("contextLine speaks only after a failure and names each cause", () => {
  expect(contextLine(check(ok(), fresh))).toBeNull();
  expect(contextLine(check(ES, fresh))).toContain("did not end with a `ROBIN:` line");
  expect(contextLine(check(ok(EN), fresh))).toContain("in English");
  expect(contextLine(check(ES, { ...fresh, streak: 1 }))).toContain("/compact");
});

test("boxOf: green with the summary, grey while waiting, red with the reason", () => {
  expect(boxOf(check(ok(), fresh))).toEqual({ tone: "ok", title: "ROBIN ✓", lines: ["Página corregida; falta mirarla."] });
  expect(boxOf(check("Espero.", { ...fresh, waiting: true }))?.tone).toBe("wait");
  expect(boxOf(check("No response requested.", fresh))).toBeNull();
  const lost = boxOf(check(ES, { ...fresh, streak: 1 }))!;
  expect(lost.tone).toBe("bad");
  expect(lost.lines.join(" ")).toContain("conviene /compact");
  expect(boxOf(check(ok(EN), fresh))).toMatchObject({ tone: "bad", title: "ROBIN ✗ idioma" });
});

test("turnOf finds the turn by its answer's end, so a vista piece and a redraw both match", () => {
  let turns = remember([], ok(), check(ok(), fresh));
  turns = remember(turns, "Otra respuesta.", check("Otra respuesta.", fresh));
  expect(turnOf(turns, ok())?.check.verdict).toBe("ok");
  expect(turnOf(turns, "Página corregida; falta mirarla.")).toBeNull();
  expect(turnOf(turns, "ROBIN: Página corregida; falta mirarla.\n")?.check.verdict).toBe("ok");
  expect(turnOf(turns, "mirarla.")).toBeNull();
  expect(turnOf(turns, "Una nota intermedia.")).toBeNull();
  expect(turnOf(turns, "   ")).toBeNull();
});

test("remember keeps the last KEEP turns", () => {
  let turns = remember([], "a", check("a", fresh));
  for (let i = 0; i < KEEP + 5; i++) turns = remember(turns, `t${i}`, check(`t${i}`, fresh));
  expect(turns.length).toBe(KEEP);
  expect(turns[0]!.answer).toBe("t5");
});

test("streakFromLog reads the last row and survives garbage", () => {
  expect(streakFromLog('{"streak":0}\n{"streak":2}\n')).toBe(2);
  expect(streakFromLog("")).toBe(0);
  expect(streakFromLog("no es json")).toBe(0);
});

test("turnOf still finds the turn when log-pose drew the opening Router lines apart", () => {
  const answer = `Router: dev-workflow no (es una lectura).\n\n${ok()}`;
  const turns = remember([], answer, check(answer, fresh));
  expect(turnOf(turns, ok())?.check.verdict).toBe("ok");
});
