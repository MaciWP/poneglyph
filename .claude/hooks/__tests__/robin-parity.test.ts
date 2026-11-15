import { expect, test } from "bun:test";
import { EN_STOPWORDS, ES_STOPWORDS, stopwordCounts } from "../lib/language";
import { isEnglishNote } from "../turn-nudges";
import { EN_STOPWORDS as MOD_EN, ES_STOPWORDS as MOD_ES, languageOf, stopwordCounts as modStopwordCounts } from "../../../plugins/robin/hooks/core.ts";

test("same stopword lists", () => {
  expect([...MOD_ES].sort()).toEqual([...ES_STOPWORDS].sort());
  expect([...MOD_EN].sort()).toEqual([...EN_STOPWORDS].sort());
});

// robin cannot import this repo's hooks (a mod loads only its own files), so it carries a copy of
// the stopword counts and of turn-nudges' English rule. These cases keep them equal.
const CASES = [
  "He corregido la página y falta mirarla en el navegador, pero no hay errores en la consola.",
  "I fixed the page and it is ready for review, but the console still has one warning that we should check.",
  "The fix is ready.",
  "Añadir la línea de contexto para que Claude lo sepa así desde el siguiente mensaje.",
  "Uso `the of and to is that it for with` dentro de código y el resto en castellano para la prueba.",
  "```ts\nconst the = this.is.for.the.with.from.that.it.and.of;\n```\nVale.",
  // A tie (2 and 2 stopwords, 10 words) stays Spanish in both.
  "the build and la prueba de hoy pasan bien ya",
  "",
];

for (const text of CASES) {
  test(`same counts and rule: ${JSON.stringify(text.slice(0, 40))}`, () => {
    expect(modStopwordCounts(text)).toEqual(stopwordCounts(text));
    expect(languageOf(text).lang === "en").toBe(isEnglishNote(text));
  });
}
