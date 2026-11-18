// Pure checks of an answer's closing `ROBIN:` line (the canary: a missing line means the context
// degraded) and of its language. No engine calls, so bun tests the whole verdict.

// Which lines sit outside code fences; a fence left open marks everything after it.
// A copy of workboard's `prose()`, which its `extractNotice` still uses.
export function prose(lines: string[]): boolean[] {
  let fence: string | null = null;
  return lines.map((line) => {
    const mark = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (mark) {
      if (!fence) fence = mark;
      else if (mark[0] === fence[0] && mark.length >= fence.length) fence = null;
      return false;
    }
    return !fence;
  });
}

// Up to 3 leading spaces still make a paragraph line, as the Stop hook's checkCanary allows them.
const ROBIN = /^ {0,3}(?:\*\*)?ROBIN:(?:\*\*)?\s+/;

// The closing line only: it must be the answer's last line and sit outside code and quotes.
export function extractRobin(value: string): { text: string; body: string } | null {
  const lines = value.trimEnd().split("\n");
  const open = prose(lines);
  let candidate = -1;
  for (let i = 0; i < lines.length; i++)
    if (open[i] && /^ {0,3}(?:\*\*)?ROBIN:(?:\*\*)?\s+\S/.test(lines[i]!)) candidate = i;
  if (candidate !== lines.length - 1 || !open[candidate]) return null;
  return {
    text: lines[candidate]!.replace(ROBIN, ""),
    body: lines.slice(0, candidate).join("\n").trimEnd(),
  };
}

// A copy of `.claude/hooks/lib/language.ts` (a mod cannot import the repo); the parity test
// keeps both equal.
export const ES_STOPWORDS = new Set(["el", "la", "los", "las", "de", "del", "que", "porque", "una", "con", "para", "está", "es", "en", "no", "se", "por", "como", "más", "pero", "desde", "así", "queda", "falta", "añadir"]);
export const EN_STOPWORDS = new Set(["the", "of", "and", "to", "is", "that", "it", "for", "with", "from", "does", "not", "because", "this", "are", "was", "be", "have"]);

export function stopwordCounts(prose: string): { es: number; en: number; words: number } {
  const words = prose.toLowerCase().split(/[^\p{L}áéíóúüñ]+/u).filter(Boolean);
  return {
    es: words.filter((w) => ES_STOPWORDS.has(w)).length,
    en: words.filter((w) => EN_STOPWORDS.has(w)).length,
    words: words.length,
  };
}

const CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g;

// The rule of turn-nudges' `isEnglishNote`: 8+ words with English stopwords ahead. That hook warns
// in the middle of a turn; this is the end-of-turn check on the final answer, and both stay.
export function languageOf(text: string): { lang: "es" | "en" | "none"; es: number; en: number; words: number } {
  const counts = stopwordCounts(text.replace(CODE, " "));
  const lang = counts.words === 0 ? "none" : counts.words >= 8 && counts.en > counts.es ? "en" : "es";
  return { lang, ...counts };
}

export type Verdict = "ok" | "miss" | "wait" | "skip";

export type Check = {
  verdict: Verdict;
  robin: string | null;
  body: string;
  lang: "es" | "en" | "none";
  es: number;
  en: number;
  words: number;
  // Answers in a row without the line; `wait` and `skip` leave it as it was.
  streak: number;
  lost: boolean;
  // Something the person and Claude should hear about: a missing line or an English answer.
  fail: boolean;
};

export const LOST_AFTER = 2;

// The rule of the Stop hook's `checkCanary`: harness filler and turns that did not answer are
// skipped, and a turn that ends waiting for background work is logged but never counted.
export function check(answer: string, { streak, waiting, answered }: { streak: number; waiting: boolean; answered: boolean }): Check {
  const text = answer.trim();
  const found = extractRobin(answer);
  const language = languageOf(found ? found.body : answer);
  const base = { robin: found?.text ?? null, body: found ? found.body : answer.trimEnd(), ...language };
  if (!answered || !text || text === "No response requested.")
    return { ...base, verdict: "skip", streak, lost: streak >= LOST_AFTER, fail: false };
  const verdict: Verdict = found ? "ok" : waiting ? "wait" : "miss";
  const next = verdict === "ok" ? 0 : verdict === "miss" ? streak + 1 : streak;
  return { ...base, verdict, streak: next, lost: next >= LOST_AFTER, fail: verdict === "miss" || language.lang === "en" };
}

// The line Claude reads with the next prompt, only after a failed turn.
export function contextLine(c: Check): string | null {
  if (!c.fail) return null;
  const parts: string[] = [];
  if (c.verdict === "miss") parts.push("your last answer did not end with a `ROBIN:` line; end every answer with it");
  if (c.lang === "en") parts.push("your last answer was in English; answer in es-ES (Spain)");
  if (c.lost) parts.push(`${c.streak} answers in a row lacked the ROBIN line, so the context may be degraded: tell the user and propose /compact`);
  return `Robin: ${parts.join(". ")}.`;
}

// What the box in the chat says: a tone, a title and the lines under it.
export function boxOf(c: Check): { tone: "ok" | "wait" | "bad"; title: string; lines: string[] } | null {
  if (c.verdict === "skip") return null;
  if (!c.fail) {
    if (c.verdict === "wait") return { tone: "wait", title: "ROBIN · esperando", lines: ["El turno espera trabajo en segundo plano; no cuenta como fallo."] };
    return { tone: "ok", title: "ROBIN ✓", lines: [c.robin ?? ""] };
  }
  const lines: string[] = [];
  if (c.robin) lines.push(c.robin);
  if (c.verdict === "miss") lines.push("La respuesta no acaba en una línea ROBIN.");
  if (c.lang === "en") lines.push("La respuesta está en inglés.");
  if (c.lost) lines.push(`${c.streak} seguidas sin ROBIN: el contexto puede estar degradado; conviene /compact.`);
  return { tone: "bad", title: c.verdict === "miss" ? "ROBIN ✗ falta" : "ROBIN ✗ idioma", lines };
}

// Verdicts of recent turns, found again by the answer's text: a reply is drawn piece by piece
// (vista splits it around tables) and redrawn whole at every turn's end, so position says nothing.
export const KEEP = 200;
export type Turn = { answer: string; check: Check };

export function remember(turns: Turn[], answer: string, c: Check): Turn[] {
  return [...turns, { answer: answer.trimEnd(), check: c }].slice(-KEEP);
}

// The turn whose final answer ends with this drawn text: all of it, or its last piece, which
// starts on a line of its own (vista cuts the reply at block boundaries).
export function turnOf(turns: Turn[], text: string): Turn | null {
  const piece = text.trim();
  if (!piece) return null;
  for (let i = turns.length - 1; i >= 0; i--) {
    const answer = turns[i]!.answer.trimStart();
    if (answer === piece || answer.endsWith(`\n${piece}`)) return turns[i]!;
  }
  return null;
}

// The streak a session left in its log, so a restarted process goes on counting.
export function streakFromLog(text: string): number {
  const last = text.trimEnd().split("\n").at(-1);
  if (!last) return 0;
  try {
    const row = JSON.parse(last) as { streak?: unknown };
    return typeof row.streak === "number" && row.streak >= 0 ? row.streak : 0;
  } catch {
    return 0;
  }
}
