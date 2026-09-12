// Deterministic graders for the golden-prompt harness (019/US3).
// Pure functions: no I/O, no network, no model calls (W2 D1 — deterministic-first;
// LLM-judge forbidden per W2 D4). Heuristics are intentionally simple and
// documented; on a fail, suspect the eval first (see README protocol, US4).

export interface CaseSpec {
  id?: string;
  prompt?: string;
  type?: string;
  grader?: string;
  expected?: string;
  trials?: number;
  source?: string;
}

export interface GradeResult {
  pass: boolean;
  unverified?: boolean;
  detail: string;
}

export type Grader = (transcript: string, caseSpec?: CaseSpec) => GradeResult;

/** Remove fenced code blocks and inline code so they never poison prose checks. */
export function stripCode(text: string): string {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
}

/** Remove fenced code blocks ONLY — keep inline `code`. Used by labelPresence, because
 * the house style writes confidence labels in inline backticks (`[Suposición — …]`), so
 * stripping inline code would hide a perfectly valid label (false negative). Fenced blocks
 * are still stripped: a label illustrated inside a ```fence``` is an example, not a real one. */
export function stripFenced(text: string): string {
  return text.replace(/```[\s\S]*?```/g, " ");
}

/** Remove double-quoted and «» segments (literal quotes are exempt from style rules). */
function stripQuoted(text: string): string {
  return text.replace(/"[^"\n]*"/g, " ").replace(/«[^»\n]*»/g, " ").replace(/“[^”\n]*”/g, " ");
}

// Kill-list from system-prompts/poneglyph-sp.md §1 Truth kill-list (ES + EN).
const BANNED_OPENERS = [
  "buena pregunta",
  "tienes toda la razón",
  "tiene mucho sentido",
  "por supuesto",
  "sin duda",
  "great question",
  "you're absolutely right",
  "makes total sense",
  "of course",
  "no doubt",
];

export const bannedOpeners: Grader = (transcript) => {
  const prose = stripQuoted(stripCode(transcript)).toLowerCase();
  for (const phrase of BANNED_OPENERS) {
    if (prose.includes(phrase)) {
      return { pass: false, detail: `banned opener present: "${phrase}"` };
    }
  }
  return { pass: true, detail: "no banned openers" };
};

// Translated-English calques from system-prompts/poneglyph-sp.md §3 Voice (the spec's own
// counter-examples). Multi-word anchors → low false-positive rate; single words like
// "déjame" alone are legitimate Spanish and are NOT listed. Failure origin: 017 retro
// (translated-English style debt). Code/quotes are stripped first (literal-quote exempt).
const CALQUES = [
  "voy a proceder a",
  "hace sentido",
  "haría sentido",
  "déjame verificar",
  "déjame comprobar",
  "es debido a que",
];

export const calqueDetect: Grader = (transcript) => {
  const prose = stripQuoted(stripCode(transcript)).toLowerCase();
  for (const phrase of CALQUES) {
    if (prose.includes(phrase)) {
      return { pass: false, detail: `calque present: "${phrase}"` };
    }
  }
  return { pass: true, detail: "no calques" };
};

// Minimal stopword lists — enough signal to separate es-ES prose from English prose.
const ES_STOPWORDS = ["el", "la", "los", "las", "de", "del", "que", "porque", "una", "con", "para", "está", "es", "en", "no", "se", "por", "como", "más", "pero", "desde", "así", "queda", "falta", "añadir"];
const EN_STOPWORDS = ["the", "of", "and", "to", "is", "that", "it", "for", "with", "from", "does", "not", "because", "this", "are", "was", "be", "have"];

export const esEsDetect: Grader = (transcript) => {
  const words = stripCode(transcript).toLowerCase().split(/[^\p{L}áéíóúüñ]+/u).filter(Boolean);
  if (words.length === 0) return { pass: true, detail: "no prose to grade" };
  const es = words.filter((w) => ES_STOPWORDS.includes(w)).length;
  const en = words.filter((w) => EN_STOPWORDS.includes(w)).length;
  if (es >= en) return { pass: true, detail: `spanish-dominant prose (es=${es}, en=${en})` };
  return { pass: false, detail: `english-dominant prose (es=${es}, en=${en})` };
};

// Preamble openers that signal the answer was NOT led with (BLUF violation).
const PREAMBLE_OPENERS = [
  "primero voy a",
  "antes de responder",
  "antes de nada",
  "para entender",
  "voy a explicar",
  "empecemos por",
  "let me start",
  "let me first",
  "first, i will",
  "to understand",
  "before answering",
];

export const blufPosition: Grader = (transcript) => {
  const prose = stripCode(transcript).trim();
  const firstParagraph = prose.split(/\n\s*\n/)[0]?.trim().toLowerCase() ?? "";
  for (const opener of PREAMBLE_OPENERS) {
    if (firstParagraph.startsWith(opener) || firstParagraph.startsWith(`¡${opener}`)) {
      return { pass: false, detail: `first paragraph is preamble ("${opener}…") — answer not led` };
    }
  }
  return { pass: true, detail: "first paragraph leads with content" };
};

const LABEL_RE = /\[(Seguro|Probable|Suposición)(\s*—\s*[^\]]+)?\]/gu;

export const labelPresence: Grader = (transcript, caseSpec) => {
  const prose = stripFenced(transcript);
  const matches = [...prose.matchAll(LABEL_RE)];
  if (matches.length === 0) {
    return { pass: false, detail: "no confidence label found" };
  }
  if (caseSpec?.expected === "payload-required") {
    const bare = matches.filter((m) => !m[2]);
    if (bare.length > 0) {
      return { pass: false, detail: `label without payload: [${bare[0][1]}] — labels must carry payload` };
    }
  }
  return { pass: true, detail: `${matches.length} labeled block(s), payload present` };
};

export const skillTriggerParse: Grader = (transcript, caseSpec) => {
  const expected = caseSpec?.expected ?? "";
  for (const line of transcript.split("\n")) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue; // corrupt lines tolerated (T3.9)
    }
    const content = (event as { message?: { content?: unknown[] } })?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      const b = block as { type?: string; name?: string; input?: { skill?: string } };
      if (b.type === "tool_use" && b.name === "Skill" && b.input?.skill === expected) {
        return { pass: true, detail: `Skill(${expected}) invoked` };
      }
    }
  }
  return { pass: false, detail: `expected Skill(${expected}) invocation not found in transcript` };
};

// Dev-loop stages (CLAUDE.md §The dev loop, 029 US-dev). The doctrine names FIVE stages
// and requires them visible in the answer — full prose or the compact scan line. Counting
// PLAN-flavoured wording instead (goal/assumptions/risks/plan) let a reply that skipped
// BUILD, REVIEW and LEARN score as compliant: the eval measured less than the rule it
// guards (H69, quality review 2026-09-11). The stage NAMES are the signal, and both
// renderings spell them.
const STAGE_NAMES = ["KNOW", "PLAN", "BUILD", "REVIEW", "LEARN"] as const;

/** expected "stages-visible": a coding reply must name all five stages. expected
 * "no-ceremony": a reply to a task with no dev loop must name at most one (the mode has no
 * live case since audit 010 — see evals/README.md — and is kept for a future one). */
export const devLoopStages: Grader = (transcript, caseSpec) => {
  // Whole-word, case-insensitive: split on runs of non-letters so "PLAN:" and "el plan"
  // both count, while "planificacion" does not.
  const words = new Set(stripCode(transcript).toUpperCase().split(/[^A-Z]+/i));
  const present = STAGE_NAMES.filter((name) => words.has(name));
  const missing = STAGE_NAMES.filter((name) => !present.includes(name));
  if (caseSpec?.expected === "no-ceremony") {
    return present.length <= 1
      ? { pass: true, detail: `proportional: ${present.length} stage name(s)` }
      : { pass: false, detail: `ceremony on trivial task: stages [${present.join(", ")}]` };
  }
  return missing.length === 0
    ? { pass: true, detail: `all five stages visible: [${present.join(", ")}]` }
    : { pass: false, detail: `dev-loop stages missing: [${missing.join(", ")}] (found: [${present.join(", ")}])` };
};

export const graders: Record<string, Grader> = {
  bannedOpeners,
  esEsDetect,
  blufPosition,
  labelPresence,
  skillTriggerParse,
  calqueDetect,
  devLoopStages,
};

// H56 (quality review 2026-09-11): the mandatory routing rows for `verify` and
// the honesty rules cannot be audited by counting invocations — the behaviour they ask
// for happens inline, where no counter sees it. Lexical markers cannot prove it either.
//
// `evidence-before-done`: a reply that declares work finished must show the evidence that
// makes "done" true — a command that ran, a count, a file:line — not a bare assertion.
// `tagged-claim`: a claim the model did not verify must carry a certainty tag (the house
// style's [Seguro] / [Probable] / [Suposición]). Two shapes are graded: an existence claim
// ("does formatDate exist?") and a diagnosed cause ("this test returns 401, why?"). The
// second one is where ayghri/i-have-adhd measured a regression of its own: a rule demanding
// "cause, then fix" pressures the model to name a cause the evidence does not identify.
const DONE_RE = /\b(hecho|listo|terminado|completado|done|finished)\b/i;
const EVIDENCE_RE = [
  /\b\d+\s*\/\s*\d+\b/,                              // 128/128
  /\b(pass|fail|passed|verde|rojo|exit\s*(code\s*)?\d)\b/i,
  /`[^`\n]*\.(ts|js|md|json|py|tsx|jsonl)(:\d+)?[^`\n]*`/, // a real path
  /\b(bun|npm|pnpm|yarn|pytest|cargo|go)\s+\w+/i,     // a command that ran
];
const TAG_RE = /\[(Seguro|Probable|Suposici[oó]n)\b/i;

export const completionEvidenceMarkers: Grader = (transcript) => {
  const prose = stripCode(transcript);
  if (!DONE_RE.test(prose)) {
    return { pass: false, detail: "no completion claim to judge" };
  }
  const found = EVIDENCE_RE.filter((re) => re.test(transcript)).length;
  return found >= 1
    ? { pass: true, detail: `completion has ${found} lexical evidence marker(s); execution is unverified` }
    : { pass: false, detail: "completion lacks lexical evidence markers" };
};

export const evidenceBeforeDone: Grader = (transcript, caseSpec) => {
  const marker = caseSpec?.expected === "tagged-claim"
    ? `confidence label ${TAG_RE.test(stripFenced(transcript)) ? "present" : "absent"}`
    : completionEvidenceMarkers(transcript).detail;
  return { pass: false, unverified: true,
    detail: `UNVERIFIED — ${marker}; prose alone cannot establish truth, abstention quality or executed checks. Validate semantics in harness-lab.` };
};

// Registered after its definition so the exported registry stays a single literal above.
graders.evidenceBeforeDone = evidenceBeforeDone;
graders.completionEvidenceMarkers = completionEvidenceMarkers;

// --- Style adherence, added 2026-09-11 (review of the `i-have-adhd` skill) ---
//
// H16: §2 already forbade cards split by a rule, naming `────`, `------` and `_____` —
// but not `---`, the markdown thematic break. In Claude Code that one renders exactly
// like the divider marking a user interruption (anthropics/claude-code#52755), so the
// reader cannot tell a finished answer from a cut-off one. The norm existed in three
// places and no grader watched any of them; 024's retro is explicit that an unwatched
// norm drifts in silence.

// A line that is ONLY a horizontal rule. A markdown table's header rule starts with `|`,
// so `|---|---|` never reaches this. Bare YAML frontmatter (`---` on its own line, outside
// a fence) DOES fail, and that is the intent: in the terminal it renders as the very divider
// this grader exists to catch. §2 wants quoted config inside a fence, where it passes.
const RULE_LINE_RE = /^\s*(?:-{3,}|_{3,}|\*{3,}|={3,}|─{2,}|—{2,})\s*$/;
const BOX_DRAWING_RE = /[┌┐└┘├┤┬┴┼│─━┃╔╗╚╝║═]/;

export const cardSeparators: Grader = (transcript) => {
  for (const line of stripFenced(transcript).split("\n")) {
    if (RULE_LINE_RE.test(line)) {
      return {
        pass: false,
        detail: `horizontal-rule separator ("${line.trim().slice(0, 12)}") — in Claude Code it reads as a user interruption (#52755); use a table or a blank line`,
      };
    }
    if (BOX_DRAWING_RE.test(line)) {
      return { pass: false, detail: `box-drawing separator in "${line.trim().slice(0, 24)}" — §2 wants markdown pipes` };
    }
  }
  return { pass: true, detail: "no rule or box-drawing separators" };
};

// §4's ceiling measures RUNNING PROSE only. Tables, lists, numbered steps and headings are
// the structure §2 mandates: counting them would fail the very shape the style demands.
export const PROSE_CEILING = 15;
const STRUCTURE_LINE_RE = /^\s*(?:[|>]|[-*+]\s|\d+[.)]\s|#{1,6}\s)/;

export const proseLength: Grader = (transcript, caseSpec) => {
  if (caseSpec?.expected !== "concise") {
    return { pass: true, detail: "case does not ask for the prose ceiling" };
  }
  const prose = stripFenced(transcript)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !STRUCTURE_LINE_RE.test(l));
  return prose.length > PROSE_CEILING
    ? { pass: false, detail: `${prose.length} lines of running prose (ceiling ${PROSE_CEILING}) — cut padding or move it to an artefact` }
    : { pass: true, detail: `${prose.length} lines of running prose, within ${PROSE_CEILING}` };
};

// §2: multi-step work WITHOUT the dev-loop scan line must restate position every turn.
// Either marker restores it; "listo, ¿seguimos?" does not.
const STEP_MARKER_RE = /\b(?:paso|step)\s+\d+\s*(?:de|of|\/)\s*\d+\b/i;
// Two icons on one line: a lone 🔴 opening a verdict is a status icon, not the scan line.
const SCAN_LINE_RE = /[🟢🔵⚪🟡🔴⛔🔄].*·.*[🟢🔵⚪🟡🔴⛔🔄]/u;

export const stepState: Grader = (transcript, caseSpec) => {
  const prose = stripFenced(transcript);
  if (STEP_MARKER_RE.test(prose)) return { pass: true, detail: "current step named against the total" };
  if (SCAN_LINE_RE.test(prose)) return { pass: true, detail: "dev-loop scan line restores the state" };
  return { pass: false, detail: "progress claimed without position: no `paso N de M` and no scan line" };
};

graders.cardSeparators = cardSeparators;
graders.proseLength = proseLength;
graders.stepState = stepState;
