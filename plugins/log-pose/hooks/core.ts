// Pure parts of log-pose: no `$`, so bun tests cover them without the engine.
// The router parts mirror `.claude/hooks/prompt-router.ts` and `router/memory.ts`: a mod cannot
// import outside its plugin. `.claude/hooks/__tests__/log-pose-parity.test.ts` holds them equal.
// ponytail: ~100 copied lines kept equal by the parity test; drop the copy once a mod can import shared code.

export const LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof LEVELS)[number];
export type Gauge = 0 | 1 | 2 | 3;

export type Labels = {
  difficulty: "easy" | "normal" | "hard";
  uncertainty: "clear" | "some-doubt" | "unclear";
  continuity: "same" | "new";
};

export type Fix = { heard: string; meant: string };
export type Pick = { name: string; why: string };
export type Reply = { fixes: Fix[]; skills: Pick[]; labels: Labels | null };
// `task`: the task's level before Opus's override and the user's floor; a `same` prompt steps down from it.
export type Decision = { effort: Effort; task: Effort; gauge: Gauge; labels: Labels | null; override: Effort | null };

export const MIN_WORDS = 6;
export const MAX_PROMPT_CHARS = 3000;
const MAX_SKILLS = 3;
const PREVIOUS_CHARS = 300;
const ANSWER_CHARS = 300;
const PROCESS_SKILLS = ["dev-workflow", "drillme-clarify", "natural-writing", "changes-verify"];
const DEEP_SKILLS = ["dev-workflow", "drillme-clarify"];
export const DEEP_SKILLS_LINE = "`dev-workflow` and `drillme-clarify` go much deeper than the summary in your instructions; that summary is never a reason for no.";

// The labels, in place of the router agent's `effort` section: Sonnet without thinking follows
// its examples, so every example carries them (eval v3 under-labelled "hard" when they lacked
// them). `task` opens the reply as the reason the labels rest on; the labels close it, because
// writing "easy" before the skills made Sonnet drop the skills of follow-ups (tune iteration 1).
export const REPLY_LINE = "Reply with one JSON object and nothing else, with its keys in this order: task, fixes, process, skills, difficulty, uncertainty, continuity.";
export const LABELS = `task: what the request asks the assistant to do and what makes it easy or hard, at most 12 words. Write it first; the three labels at the end follow from it.

difficulty: how much reasoning the work this prompt asks for now needs.
- "easy": a question, a lookup, a status check, or a one-line or mechanical edit.
- "normal": a scoped change in one or a few files, a review, or a bug whose cause is known. Most requests are normal.
- "hard": design or architecture choices, a new module, concurrency or race conditions, security or auth logic, data migrations or schema changes, a refactor across many files, or a bug whose cause is unknown or that already resisted fixes.
- Between normal and hard, pick hard.

uncertainty: how sure the way forward is.
- "clear": the goal and the way are obvious.
- "some-doubt": one open point, such as an unknown cause or an ambiguous detail.
- "unclear": the goal or the cause is unknown, or a wrong step is costly or hard to undo.

continuity: "same" when the request continues the task of the <previous> request, "new" when it starts a different task or there is no previous request.

For a "same" request, <last-turn> says how the previous turn ran and how it ended: rate difficulty and uncertainty for the work still left, not for the whole task. A check, a commit or a question about the result is easy even after a hard turn; a turn that failed, was interrupted or left the hard part open keeps the work hard.

Read <previous> and <last-turn> only for these labels; decide fixes, process and skills from <prompt> alone.`;
export const FIX_RULE = `- "heard" must sound like "meant" or one of its glossary variants. A different word that only fits the topic is not a fix.`;
// The router agent's five examples, with the labels added; the parity test holds their fixes,
// process and skills equal to the agent's.
export const EXAMPLES = `Examples:
<prompt>revisa la PR de esta rama y deja los comentarios sin publicar</prompt>
<previous>(none)</previous>
{"task": "review a branch's PR, comments stay as drafts", "fixes": [], "process": {"dev-workflow": "", "drillme-clarify": "", "natural-writing": "", "changes-verify": ""}, "skills": [{"why": "review this branch's PR, leave draft comments", "name": "pr-review"}], "difficulty": "normal", "uncertainty": "clear", "continuity": "new"}

<prompt>implementa la exportación a CSV del listado y sus tests, pero antes aclara conmigo qué columnas hacen falta</prompt>
<previous>(none)</previous>
{"task": "new CSV export with tests; the columns are still open", "fixes": [], "process": {"dev-workflow": "implement the CSV export and its tests", "drillme-clarify": "clarify the needed columns first", "natural-writing": "", "changes-verify": ""}, "skills": [{"why": "implement the CSV export and its tests", "name": "dev-workflow"}, {"why": "clarify the needed columns first", "name": "drillme-clarify"}], "difficulty": "normal", "uncertainty": "some-doubt", "continuity": "new"}

<prompt>me parece bien lo que propones, sigue con el siguiente paso del plan</prompt>
<previous>añade la validación del formulario de alta siguiendo el plan</previous>
{"task": "approval; do the plan's next, already agreed step", "fixes": [], "process": {"dev-workflow": "", "drillme-clarify": "", "natural-writing": "", "changes-verify": ""}, "skills": [], "difficulty": "normal", "uncertainty": "clear", "continuity": "same"}

<prompt>haz la prueva otra vez en pone grif y mira si el jaiku contesta</prompt>
<previous>(none)</previous>
{"task": "rerun one check and read the answer", "fixes": [{"heard": "pone grif", "meant": "Poneglyph"}, {"heard": "jaiku", "meant": "Haiku"}], "process": {"dev-workflow": "", "drillme-clarify": "", "natural-writing": "", "changes-verify": ""}, "skills": [], "difficulty": "easy", "uncertainty": "clear", "continuity": "new"}

<prompt>a veces dos peticiones refrescan el token a la vez y el login falla; encuentra la causa y arréglalo</prompt>
<previous>(none)</previous>
{"task": "race between concurrent token refreshes, cause unknown", "fixes": [], "process": {"dev-workflow": "find and fix the token refresh failure", "drillme-clarify": "", "natural-writing": "", "changes-verify": "fix the login failure"}, "skills": [{"why": "find and fix the token refresh failure", "name": "dev-workflow"}], "difficulty": "hard", "uncertainty": "some-doubt", "continuity": "new"}`;

// The fallback when the agent file no longer has the sections the mod rebuilds: appended to
// the agent's prompt as it is, whose own `effort` key is then asked for and ignored.
export const RUBRIC = `Also add three keys to the same JSON object:
"difficulty": "easy" (a question, a lookup, a one-line or mechanical edit), "normal" (a scoped change across a few files, a bug with a known cause) or "hard" (design, architecture, a new module, a bug with an unknown cause, security, migrations, many files).
"uncertainty": "clear" (the goal and the way are obvious), "some-doubt" (one open point, such as an unknown cause or an ambiguous detail) or "unclear" (the goal or the cause is unknown, or a wrong step is costly or hard to undo).
"continuity": "same" (it continues the task of the <previous> request) or "new" (a different task, or there is no previous request).`;

// Difficulty sets the effort, uncertainty the advisor gauge (plan 044 §Two axes). No cell gives
// xhigh: Sonnet paired "hard" with "unclear" 11 times in 14 (10-22/23), so that cell put 19 % of
// prompts at xhigh; `decide` raises it only when the hard part outlived a turn at high or above.
export const MATRIX: Record<Labels["difficulty"], Record<Labels["uncertainty"], { effort: Effort; gauge: Gauge }>> = {
  easy: { clear: { effort: "low", gauge: 0 }, "some-doubt": { effort: "medium", gauge: 1 }, unclear: { effort: "medium", gauge: 2 } },
  normal: { clear: { effort: "medium", gauge: 1 }, "some-doubt": { effort: "medium", gauge: 2 }, unclear: { effort: "high", gauge: 2 } },
  hard: { clear: { effort: "high", gauge: 2 }, "some-doubt": { effort: "high", gauge: 3 }, unclear: { effort: "high", gauge: 3 } },
};

const rank = (e: Effort) => LEVELS.indexOf(e);
const maxOf = (a: Effort, b: Effort) => (rank(a) >= rank(b) ? a : b);
const CAP: Effort = "xhigh";

// Matrix on the prompt's labels, then the mod's cap, then Opus's override, then the user's floor
// (`max` stays `max`). A `new` task clears the override. A follow-up is labelled with
// `<last-turn>` in view, so its labels already say whether the task's level should hold: read
// alone, a follow-up looked easy and dropped a hard task to medium (f1a14766, 46957340), and a
// rule that only raised held one hard question's xhigh for 8 prompts (10-23).
// `last`: the level the previous main turn ran at. A follow-up still hard and unclear after a turn
// at high or above escalates to xhigh; an easy one with one open point (a check, a commit) drops
// to low. The user's target is about low 10, medium 50, high 30 and xhigh 10 %; on 57 live calls
// these two rules gave 14 / 54 / 25 / 7 % (10-23 review).
export function decide(labels: Labels, override: Effort | null, floor: Effort | null, last: string | null = null): Decision {
  const cell = MATRIX[labels.difficulty][labels.uncertainty];
  const same = labels.continuity === "same";
  const level: Effort = same && labels.difficulty === "hard" && labels.uncertainty === "unclear" && (last === "high" || last === "xhigh") ? "xhigh"
    : same && labels.difficulty === "easy" && labels.uncertainty === "some-doubt" ? "low" : cell.effort;
  const task = rank(level) > rank(CAP) ? CAP : level;
  const kept = labels.continuity === "new" ? null : override;
  const chosen = kept ?? task;
  return { effort: floor ? maxOf(chosen, floor) : chosen, task, gauge: cell.gauge, labels, override: kept };
}

// The user's floor over a decision, so the note names the level the steps run at.
export const withFloor = (d: Decision, floor: Effort | null): Decision => (floor ? { ...d, effort: maxOf(d.effort, floor) } : d);

// The user's `/effort` counts as a floor unless it is Opus 5.5's default.
export const floorOf = (effort: unknown): Effort | null =>
  typeof effort === "string" && effort !== "medium" && (LEVELS as readonly string[]).includes(effort) ? (effort as Effort) : null;

// The session's level before its first step names one: the model's own level in the settings,
// else the global one. The effort picker writes both into the user's settings.json.
export function settingsEffort(settings: Readonly<Record<string, unknown>>, model: string): unknown {
  const perModel = settings.modelSettings as Record<string, { effortLevel?: unknown } | undefined> | undefined;
  return perModel?.[model]?.effortLevel ?? settings.effortLevel ?? null;
}

const CONTINUATIONS = new Set(["sigue", "continua", "ok", "vale", "dale", "si", "adelante", "go on", "continue", "go ahead"]);
export const foldText = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export const isContinuation = (text: string) => CONTINUATIONS.has(foldText(text).replace(/[\s.!¡?¿,]+$/g, "").replace(/^[\s¡¿]+/, "").trim());

// The text worth a classifier call, as the hook's `routablePrompt` judges a typed prompt.
export function routable(text: string): string | null {
  const goal = text.trimStart().match(/^\/goal\s+(.+)/is);
  const body = goal ? goal[1]! : text;
  if (!goal && body.trimStart().startsWith("/")) return null;
  if (body.trim().split(/\s+/).length < MIN_WORDS) return null;
  return body.slice(0, MAX_PROMPT_CHARS);
}

// --- The router agent file (`<config>/agents/prompt-router.md`, written by sync-claude) ---

// `terms`: each glossary term, folded, with its heard variants.
export type Agent = { system: string; known: Set<string>; terms: Map<string, string[]>; kind: "mod" | "fallback" };

// The agent's intro, the mod's reply line, the agent's fixes, process and skills sections, then
// the mod's labels and examples in place of its `effort` section and examples, then its glossary and catalog.
const SECTIONS = /^([\s\S]*?)\n\nReply with one JSON object[^\n]*\n\n(fixes:[\s\S]*?)\n\n(process:[\s\S]*?)\n\n(skills:[\s\S]*?)\n\neffort:[\s\S]*?\n\nExamples:\n[\s\S]*?\n\n(Glossary \(term: heard variants\):\n[\s\S]*)$/;

// `fallback` forces the old prompt, for the eval's study arm.
export function parseAgentFile(text: string, fallback = false): Agent | null {
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  const catalog = body.split("\nCatalog (name: description):\n")[1];
  if (!catalog) return null;
  const known = new Set([...catalog.matchAll(/^- ([\w:-]+): /gm)].map((m) => m[1]!));
  const glossary = body.match(/\nGlossary \(term: heard variants\):\n(.*)\n/)?.[1] ?? "";
  const terms = new Map(glossary === "(none)" ? [] : glossary.split(" | ").map((t) => {
    const [term, heard = ""] = t.split(": ");
    return [foldText(term!.trim()), heard.split(", ").map((h) => h.trim()).filter(Boolean)] as [string, string[]];
  }).filter(([t]) => t));
  const s = fallback ? null : body.match(SECTIONS);
  const system = s
    ? [s[1], REPLY_LINE, `${s[2]}\n${FIX_RULE}`, s[3], s[4], LABELS, EXAMPLES, s[5]].join("\n\n")
    : `${body}\n\n${RUBRIC}`;
  return { system, known, terms, kind: s ? "mod" : "fallback" };
}

// A description cut to `max` at a sentence end, its "not for" sentences kept: a cut mid-word at 600
// dropped xlsx's "Do NOT trigger when…", the line that tells the router when not to suggest it.
const NOT_FOR = /^(?:no|not|never|nunca|do not|don't)\b/i;
export function clipDescription(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const sentences = flat.split(/(?<=[.!?])\s+(?=[\p{Lu}¿¡"'`(])/u);
  const not = sentences.filter((s) => NOT_FOR.test(s)).join(" ").slice(0, max);
  const room = max - (not ? not.length + 1 : 0);
  const rest = sentences.filter((s) => !NOT_FOR.test(s));
  let kept = "";
  for (const s of rest) {
    if ((kept ? kept.length + 1 : 0) + s.length > room) break;
    kept = kept ? `${kept} ${s}` : s;
  }
  // A first sentence longer than the room is cut at a word.
  if (!kept && rest.length && room > 1) kept = `${rest[0]!.slice(0, room - 1).replace(/\s\S*$/, "")}…`;
  return [kept, not].filter(Boolean).join(" ");
}

// The project's skills the synced agent file does not list, as catalog lines for the prompt.
export function extraCatalog(entries: { name: string; description: string }[], known: Set<string>): string {
  const extra = entries.filter((e) => !known.has(e.name));
  return extra.length ? `<extra-catalog>\n${extra.map((e) => `- ${e.name}: ${clipDescription(e.description, 600)}`).join("\n")}\n</extra-catalog>` : "";
}

// The glossary files the hook reads live (core, then personal), merged as loadGlossary does.
export function mergeGlossaries(texts: string[]): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  for (const text of texts) {
    try {
      for (const [term, heard] of Object.entries(JSON.parse(text) as Record<string, unknown>)) {
        if (Array.isArray(heard)) merged[term] = [...new Set([...(merged[term] ?? []), ...heard.filter((h): h is string => typeof h === "string")])];
      }
    } catch { /* missing or invalid */ }
  }
  return merged;
}

// Terms added since the last sync: a prompt block for the model, and every term fixes may land on
// with its variants from the agent file and the live glossaries, as the hook's filter sees them.
export function extraGlossary(glossary: Record<string, string[]>, terms: ReadonlyMap<string, string[]>): { block: string; terms: Map<string, string[]> } {
  const extra = Object.entries(glossary).filter(([term]) => !terms.has(foldText(term)));
  const all = new Map(terms);
  for (const [term, heard] of Object.entries(glossary)) all.set(foldText(term), [...new Set([...(all.get(foldText(term)) ?? []), ...heard])]);
  return {
    block: extra.length ? `<extra-glossary>\n${extra.map(([term, heard]) => `${term}: ${heard.join(", ")}`).join(" | ")}\n</extra-glossary>` : "",
    terms: all,
  };
}

// Skills the session already loaded, from its history: survives a resume, unlike a counter.
export function skillsInHistory(messages: readonly { toolUses?: readonly { tool: string; input: Record<string, unknown> }[] }[]): string[] {
  return messages.flatMap((m) => (m.toolUses ?? []).filter((u) => u.tool === "Skill" && typeof u.input.skill === "string").map((u) => u.input.skill as string));
}

// Skills for a phase the prompt rarely names (plan 044 S4): over 7 days the Lead launched agents in
// 50 sessions with prompt-design loaded first in 5, and published artifacts in 22 with
// natural-writing loaded first in 2. A hint after the call was followed 3 times in 13 (10-23), so
// the first call is refused once with the hint as its error; the repeated call passes.
export const PHASE_SKILLS: Readonly<Record<string, { skill: string; hint: string }>> = {
  Agent: { skill: "prompt-design", hint: "load it and brief the agent with it, then repeat this call; the repeat is not blocked." },
  Artifact: { skill: "natural-writing", hint: "load it and review this page's prose, then repeat this publish; the repeat is not blocked." },
};

// The block for a main-loop call, once per skill and session: none when the skill is loaded,
// already hinted or not in the catalog, or when an Artifact call only reads or lists.
export function phaseHint(tool: string, input: Readonly<Record<string, unknown>>, loaded: ReadonlySet<string>, known: ReadonlySet<string>, hinted: ReadonlySet<string>): { skill: string; text: string } | null {
  const p = PHASE_SKILLS[tool];
  if (!p || hinted.has(p.skill) || !known.has(p.skill)) return null;
  if ([...loaded].some((n) => n.split(":").pop() === p.skill)) return null;
  if (tool === "Artifact" && (input.action ?? "publish") !== "publish") return null;
  // The router agent takes a one-line task, not a brief; refusing it would only cost a step.
  if (tool === "Agent" && input.subagent_type === "prompt-router") return null;
  return { skill: p.skill, text: `Log Pose: Skill(${p.skill}) is not loaded; ${p.hint}` };
}

// A skill the model can load, as the hook's loadCatalog reads it: a folded (`>-`) or wrapped value
// read whole, `when_to_use` after the description, `disable-model-invocation: true` left out.
export function skillFrontmatter(text: string): { name: string; description: string } | null {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  const field = (key: string) => {
    const m = fm?.match(new RegExp(`^${key}:[ \\t]*(.*)((?:\\r?\\n[ \\t]+.*)*)`, "m"));
    if (!m) return "";
    const value = /^[>|][+-]?$/.test(m[1]!.trim()) ? m[2]! : `${m[1]}${m[2]}`;
    return value.replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "");
  };
  if (field("disable-model-invocation") === "true") return null;
  const name = field("name");
  const description = [field("description"), field("when_to_use")].filter(Boolean).join(" ");
  return name && field("description") ? { name, description } : null;
}

// How the previous main turn ran, so a follow-up's labels rate the work still left.
export type LastTurn = { level: string | null; steps: number; tools: number; aborted: boolean; answer: string };

export function lastTurnBlock(t: LastTurn): string {
  const answer = t.answer.replace(/\s+/g, " ").trim();
  const tail = answer.length > ANSWER_CHARS ? `…${answer.slice(-ANSWER_CHARS)}` : answer || "(no text)";
  return `<last-turn>Ran at ${t.level ?? "the session's"} effort: ${t.steps} steps, ${t.tools} tool calls${t.aborted ? ", interrupted by the user" : ""}. Its answer ended: ${tail}</last-turn>`;
}

export function classifierPrompt(text: string, previous: string, past: string, extra: string, last: LastTurn | null = null): string {
  const prev = previous.trim().slice(0, PREVIOUS_CHARS);
  return [`<prompt>${text}</prompt>`, past, extra, `<previous>${prev || "(none)"}</previous>`, prev && last ? lastTurnBlock(last) : ""].filter(Boolean).join("\n\n");
}

// --- The reply ---

const DIFFICULTY = new Set(["easy", "normal", "hard"]);
const UNCERTAINTY = new Set(["clear", "some-doubt", "unclear"]);
const CONTINUITY = new Set(["same", "new"]);
const isNo = (v: string) => /^(?:|no|none|false|n\/a|not needed|-|—)$/i.test(v.trim().replace(/^["'`]+|["'`]+$/g, "").trim().replace(/\.$/, ""));

// A fix that only respells a right word (plural, case, space or hyphen: "repos" → repo,
// "agentic-os" → Agentic OS) tells the reader nothing; eval v3 counted them as noise.
export function isVariant(heard: string, meant: string): boolean {
  const a = foldText(heard).replace(/[^a-z0-9]/g, ""), b = foldText(meant).replace(/[^a-z0-9]/g, "");
  return a === b || a === `${b}s` || a === `${b}es` || b === `${a}s` || b === `${a}es`;
}

// How a word sounds to Spanish speech-to-text: folded, then one spelling per sound.
export const soundKey = (text: string) => foldText(text).replace(/[^a-z0-9]/g, "")
  .replace(/ph/g, "f").replace(/th/g, "t").replace(/ck/g, "k").replace(/qu/g, "k")
  .replace(/c(?=[ei])/g, "s").replace(/[cq]/g, "k").replace(/x/g, "ks").replace(/z/g, "s")
  .replace(/g(?=[ei])/g, "j").replace(/[jh]/g, "").replace(/v/g, "b").replace(/w/g, "u").replace(/y/g, "i")
  .replace(/(.)\1+/g, "$1");

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length]!;
}

// A fix must sound like its term or one of the term's variants; without this the model lands
// any word on the topic on a glossary term ("astra" → Codex). 0.6 split the glossary's variants
// and eval v3's tune-split fixes from the invented ones (highest invented 0.58); the test split stays held out.
// A key of 3 letters or fewer must match exactly: one edit from "pr" is 0.67, and "PRO" (meant
// prompt) landed on PR (10-23).
export function soundsLike(heard: string, meant: string, variants: readonly string[]): boolean {
  const h = soundKey(heard);
  return [meant, ...variants].some((v) => {
    const k = soundKey(v);
    if (!h || !k) return false;
    if (Math.min(h.length, k.length) <= 3) return h === k;
    return 1 - distance(h, k) / Math.max(h.length, k.length) >= 0.6;
  });
}

// A fix lands on a glossary term and sounds like it or a variant, or on a catalog name and sounds
// like one of its parts of 4+ letters: "trillme" → drillme-clarify scores 0.38 on the whole name.
export function landsOn(heard: string, meant: string, terms: ReadonlyMap<string, readonly string[]>, known: ReadonlySet<string>): boolean {
  const variants = terms.get(foldText(meant)) ?? (known.has(meant) ? meant.split(/[-:]/).filter((p) => p.length >= 4) : null);
  return !!variants && soundsLike(heard, meant, variants);
}

// The reply's JSON object: the span from the first { to the last }, or, when the model wrote a
// corrected object after the first ("Correction: …", eval v3 test split), the last one that parses.
export function jsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { /* two objects, or prose between */ }
  for (let i = text.lastIndexOf("{", end); i > start; i = text.lastIndexOf("{", i - 1)) {
    try { return JSON.parse(text.slice(i, end + 1)); } catch { /* an inner brace */ }
  }
  return null;
}

// Mirrors `parseRouterOutput` from the JSON object on: unknown skills, skills the prompt
// already names or the session already loaded, and fixes that miss the prompt, the glossary
// or the sound of their term are dropped. Null when the reply holds no JSON object.
export function parseReply(text: string, prompt: string, known: Set<string>, terms: ReadonlyMap<string, string[]> | null, loaded: Set<string> = new Set()): Reply | null {
  const answer = jsonObject(text);
  if (!answer || typeof answer !== "object") return null;
  const folded = foldText(prompt);
  const fixed = new Set<string>();
  const fixes = (Array.isArray(answer.fixes) ? answer.fixes : [])
    .filter((f): f is Fix => typeof f?.heard === "string" && typeof f?.meant === "string")
    .map((f) => ({ heard: f.heard.trim(), meant: f.meant.trim() }))
    .filter((f) => f.heard && f.meant && f.heard.length <= 60 && f.meant.length <= 60 &&
      !isVariant(f.heard, f.meant) && folded.includes(foldText(f.heard)) && (!terms || landsOn(f.heard, f.meant, terms, known)))
    // "cloud code" and "Cloud Code" → Claude Code is one fix (10-22).
    .filter((f) => !fixed.has(foldText(`${f.heard}→${f.meant}`)) && !!fixed.add(foldText(`${f.heard}→${f.meant}`)))
    .slice(0, 5);
  const process = answer.process;
  const companions = process && typeof process === "object"
    ? Object.entries(process as Record<string, unknown>)
      .filter(([name, v]) => PROCESS_SKILLS.includes(name) && (v === true || (typeof v === "string" && !isNo(v))))
      .map(([name, v]) => ({ name, why: typeof v === "string" ? v : "" })) : [];
  const seen = new Set<string>();
  const skills = [...(Array.isArray(answer.skills) ? answer.skills : []), ...companions]
    .filter((s): s is { name: string; why?: unknown } => typeof s?.name === "string")
    .filter((s) => known.has(s.name) && !folded.includes(`/${s.name}`) && !folded.includes(`$${s.name}`) && !loaded.has(s.name) && !seen.has(s.name) && seen.add(s.name))
    .slice(0, MAX_SKILLS)
    .map((s) => ({ name: s.name, why: typeof s.why === "string" ? s.why.replace(/\s+/g, " ").trim().slice(0, 100) : "" }));
  const word = (k: string) => (typeof answer[k] === "string" ? (answer[k] as string).trim().toLowerCase() : "");
  const [difficulty, uncertainty, continuity] = [word("difficulty"), word("uncertainty"), word("continuity")];
  const labels = DIFFICULTY.has(difficulty) && UNCERTAINTY.has(uncertainty) && CONTINUITY.has(continuity)
    ? ({ difficulty, uncertainty, continuity } as Labels) : null;
  return { fixes, skills, labels };
}

// --- The note ---

const GAUGE: Record<Gauge, string> = {
  0: "Better not to call the advisor on this task.",
  1: "Call the advisor only if you get stuck or are about to take a risky, hard-to-undo step.",
  2: "Call the advisor once before declaring done.",
  3: "Call the advisor before committing to a plan, when stuck, and before declaring done.",
};
const DOUBT: Record<Labels["uncertainty"], string> = { clear: "clear", "some-doubt": "some doubt", unclear: "unclear" };
const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// With a floor above the mod's level the steps run at the floor, so the note names both.
export function effortNote(d: Decision, reason?: string, floor: Effort | null = null): string {
  const why = d.override ? `your override${reason ? `: ${reason}` : ""}` : d.labels ? `${d.labels.difficulty}, ${DOUBT[d.labels.uncertainty]}` : "kept from the previous prompt";
  const level = floor && rank(floor) > rank(d.effort) ? `${floor} for this prompt (the session's own level, a floor over Log Pose's ${d.effort}: ${why})` : `${d.effort} for this prompt (${why})`;
  const after = d.override ? " Send auto when the task changes." : "";
  return `Effort: ${level}. Advisor gauge ${d.gauge}: ${GAUGE[d.gauge]} Wrong level? Call mcp__log-pose__set; it applies from the next step.${after}`;
}

// The router note as the hook writes it (`buildRouterNote`), with the effort line in place of
// the hook's "propose /effort high". `turn-nudges.ts` and `skill-usage.ts` read this shape.
export function buildNote(reply: Pick[] | Reply, prompt: string, effort: string): string {
  const r = Array.isArray(reply) ? { fixes: [], skills: reply } : reply;
  if (!r.fixes.length && !r.skills.length && !effort) return "";
  const words = prompt.replace(/\s+/g, " ").trim().split(" ");
  const re = escapeAttr(words.slice(0, 8).join(" ") + (words.length > 8 ? " …" : ""));
  const lines = [`<prompt-router re="${re}">`, "A cheap model read the user's prompt before you started."];
  if (r.fixes.length) lines.push(`Probable dictation fixes: ${r.fixes.map((f) => `"${f.heard}" → ${f.meant}`).join("; ")}.`);
  if (r.skills.length) {
    lines.push("Candidate skills: answer each one now in one progress line, `Router: <skill> sí (<why>); <skill> no (<why>)`, then load the yes ones with the Skill tool.");
    lines.push(...r.skills.map((s) => `- Skill(${s.name})${s.why ? `: ${s.why}` : ""}`));
    if (r.skills.some((s) => DEEP_SKILLS.includes(s.name))) lines.push(DEEP_SKILLS_LINE);
  }
  if (effort) lines.push(effort);
  lines.push("</prompt-router>");
  return lines.join("\n");
}

// --- Memory (`<config>/router-memory.jsonl`, rebuilt by the hook's memory.ts) ---

export type MemoryEntry = { at: number; prompt: string; skills: string[]; declined?: string[] };

const STOP = new Set(("que los las del por para con una uno unos unas como pero mas esto esta este estos estas eso esa ese hay hace hacer sea ser son sin sobre todo todos toda todas tambien muy porque cuando donde algo aqui ahi asi solo mismo misma puede puedes podemos quiero creo vale bien entonces luego ahora antes despues tiene tienen tenemos the and for with this that are you your from have has was were not but can will what when which into about there here they them then than just also all any its our out use")
  .split(" "));
const memoryTokens = (text: string): string[] => (foldText(text).match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((t) => !STOP.has(t));

export function parseMemory(jsonl: string): MemoryEntry[] {
  const out: MemoryEntry[] = [];
  for (const line of jsonl.split("\n")) {
    try {
      const e = JSON.parse(line) as MemoryEntry;
      if (typeof e?.prompt === "string" && Array.isArray(e.skills)) out.push(e);
    } catch { /* blank or partial line */ }
  }
  return out;
}

// BM25, as memory.ts's similarPast: an entry must share `minShared` distinct words.
export function similarPast(prompt: string, memory: MemoryEntry[], k = 3, minShared = 2): MemoryEntry[] {
  const query = [...new Set(memoryTokens(prompt))];
  if (!query.length || !memory.length) return [];
  const docs = memory.map((e) => memoryTokens(e.prompt));
  const avg = docs.reduce((n, d) => n + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const scored = docs.map((d, i) => {
    let score = 0;
    let shared = 0;
    for (const q of query) {
      const tf = d.filter((t) => t === q).length;
      if (!tf) continue;
      shared++;
      const n = df.get(q)!;
      score += Math.log(1 + (docs.length - n + 0.5) / (n + 0.5)) * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * d.length / avg));
    }
    return { e: memory[i]!, score, shared };
  });
  return scored.filter((s) => s.shared >= minShared).sort((a, b) => b.score - a.score).slice(0, k).map((s) => s.e);
}

export function pastFor(prompt: string, known: Set<string>, memory: MemoryEntry[]): MemoryEntry[] {
  return similarPast(prompt, memory.map((e) => ({ ...e, skills: e.skills.filter((n) => known.has(n)), declined: (e.declined ?? []).filter((n) => known.has(n)) }))
    .filter((e) => e.skills.length || e.declined.length));
}

export function formatPast(entries: MemoryEntry[]): string {
  if (!entries.length) return "";
  const outcome = (e: MemoryEntry) => [e.skills.join(", "), e.declined?.length ? `declined: ${e.declined.join(", ")}` : ""].filter(Boolean).join(" · ");
  return ["<past>", ...entries.map((e) => `- "${e.prompt.replace(/"/g, "'")}" → ${outcome(e)}`), "</past>"].join("\n");
}

// --- Cache guard ---

export type StepUsage = { input: number; read: number; write: number };

// A level change broke the cache when step 0 read under 90 % of the previous main step's prefix.
export function cacheBroke(prev: StepUsage, now: StepUsage): boolean {
  const prefix = prev.read + prev.write + prev.input;
  return prefix > 0 && now.read < 0.9 * prefix;
}

// --- Logs ---

export type Outcome = "ok" | "empty" | "bad-output" | "error" | "timeout" | "superseded";

// One line of the router log, in the hook's shape: Agentic OS parses it with a strict schema.
// `via=mod` lets the hook see the mod failing and route again (`modFailing` in prompt-router.ts),
// so `sid=` stays last. `effort` is the mod's own level and `floor` the session's above it ("-"
// none), where the hook's `effort=high` means it proposed `/effort high`. `in` counts the
// cache read and write too, as the hook's does; `read` and `write` split them out for pricing.
export function logLine(at: string, f: { session: string; outcome: Outcome; ms: number; skills: string[]; fixes: number; effort: string; floor?: string; past: number; input?: number; output?: number; read?: number; write?: number }): string {
  const sid = f.session.replace(/[^\w-]/g, "");
  return `${at} host=claude via=mod session=${sid.slice(0, 8)} outcome=${f.outcome} ms=${Math.round(f.ms)} skills=${f.skills.join(",") || "-"} fixes=${f.fixes} effort=${f.effort} floor=${f.floor ?? "-"} past=${f.past} attended=1 entry=cli cost=- read=${f.read ?? "-"} write=${f.write ?? "-"} in=${f.input ?? "-"} out=${f.output ?? "-"} sid=${sid}`;
}

// Where the hook's `learnedLog` puts a log: in the project only when git ignores it there,
// else under the config dir, one folder per project.
export const learnedPath = (root: string, config: string, ignored: boolean, name: string) =>
  ignored ? `${root}/.claude/learned/${name}` : `${config}/learned/${root.replace(/[^\w.-]+/g, "-")}/${name}`;

// The whole file after appending `line`, dropping the oldest lines past `maxBytes`.
export function appendCapped(text: string, line: string, maxBytes = 2 * 1024 * 1024): string {
  let out = `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`;
  if (out.length > maxBytes) out = out.slice(out.indexOf("\n", out.length - maxBytes) + 1);
  return out;
}
