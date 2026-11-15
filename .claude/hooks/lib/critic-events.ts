// Ordered event reader for a Claude Code main-session transcript, shared by the critic gates
// (`critic-gate.ts`), their replay and the critic log (`scripts/critic-report.ts`).
//
// Transcript facts it relies on (read from real sessions, Claude Code 2.1.319-2.1.322):
// - An Agent spawn is an assistant `tool_use` named `Agent`; its `tool_result` record carries
//   `toolUseResult.resolvedModel`, `agentId` and, for a background spawn, `status: "async_launched"`.
// - A foreground answer is in that `tool_result`: in `toolUseResult.handbackReport.text` when
//   the agent handed back (2.1.322; `content` then only points at the message), else in `content`.
//   The same report also arrives as a message holding `<agent-message from="<agentId>">`.
// - A background agent's answer is a message holding `<task-notification>` with `<tool-use-id>`,
//   `<status>` and `<result>`. The `queue-operation` records around it are not a delivery.
// - A message that lands mid-turn is a `queued_command` attachment; one that lands while the
//   session is idle is a `user` record whose content is the same text.
// - Plan mode changes are `permission-mode` records.
// A spawn can therefore show several deliveries; consumers take the first complete one.
import { isAbsolute, join } from "node:path";
import { isHumanOrigin, queuedPromptOf, userPromptOf } from "./transcript";

export type CriticMode = "plan" | "feature" | "doubt";

export type Event =
  | { kind: "edit"; idx: number; path: string; lines: number }
  | { kind: "spawn"; idx: number; id: string; type: string; async: boolean; resolvedModel?: string }
  | { kind: "result"; idx: number; id: string; status: string; text: string }
  | { kind: "tool"; idx: number; id: string; name: string; input: Record<string, unknown>; ok?: boolean }
  | { kind: "text"; idx: number; text: string }
  /** `queued`: typed while the Lead was working; it lands mid-turn and does not open a turn. */
  | { kind: "prompt"; idx: number; text?: string; queued?: boolean }
  /** A message that opens a turn without a human: a courier or other plugin message. */
  | { kind: "wake"; idx: number }
  | { kind: "mode"; idx: number; mode: string };

type Of<K extends Event["kind"]> = Extract<Event, { kind: K }>;
const is = <K extends Event["kind"]>(kind: K) => (e: Event): e is Of<K> => e.kind === kind;

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
/** The path an edit made through the shell is recorded under. */
export const BASH_EDIT = "(bash)";

const lineCount = (s: unknown): number => (typeof s === "string" && s.length ? s.split("\n").length : 0);

function editLines(name: string, input: Record<string, unknown>): number {
  if (name === "Write") return lineCount(input.content);
  if (name === "Edit") return Math.max(lineCount(input.old_string), lineCount(input.new_string));
  if (name === "MultiEdit" && Array.isArray(input.edits)) {
    return input.edits.reduce((n: number, e: Record<string, unknown>) => n + Math.max(lineCount(e?.old_string), lineCount(e?.new_string)), 0);
  }
  return 1;
}

export const PLAN_PATH = /\/\.claude\/plans(\/|$)/;

/** Working notes, not the delivered change: plans, memory, transcripts, temp and scratch files. */
export const isWorkingNote = (path: string): boolean => PLAN_PATH.test(path) || /\/\.claude\/projects(\/|$)|\/memory(\/|$)|^\/(private\/)?tmp(\/|$)|^\/(private\/)?var\/folders\/|^\/dev\//.test(path);

// A line an answer-rows section is made of: blank, its heading, a table separator or header, or a `| H# |` row.
const ROWS_LINE = /^\s*$|^#+\s*critic answers|^\|[\s:|-]+\|?\s*$|^\|\s*\**H\d+|^\|\s*(?:hallazgo|finding|id|h)\s*\|/i;

/**
 * The lines a plan Edit, MultiEdit or Write adds, against the file as last seen (`known`, updated
 * here): rows already in the file from an earlier review are not answers to the next one.
 */
function addedPlanLines(name: string, path: string, input: Record<string, unknown>, known: Map<string, string>): string[] {
  const pairs = name === "Write" ? [[known.get(path) ?? "", String(input.content ?? "")]]
    : name === "MultiEdit" && Array.isArray(input.edits) ? input.edits.map((e: Record<string, unknown>) => [String(e?.old_string ?? ""), String(e?.new_string ?? "")])
    : [[String(input.old_string ?? ""), String(input.new_string ?? "")]];
  if (name === "Write") known.set(path, String(input.content ?? ""));
  else if (known.has(path)) known.set(path, pairs.reduce((s, [o, n]) => s.replace(o, n), known.get(path)!));
  return pairs.flatMap(([o, n]) => { const had = new Set(o.split("\n")); return n.split("\n").filter((l) => !had.has(l)); });
}

const HEREDOC = /<<-?\s*(['"]?)(\w+)\1([^\n]*)\n([\s\S]*?)\n\s*\2\s*(?=\n|$)/g;

/**
 * The lines heredocs in `cmd` add to a plan file, each tied to its own `>`, `>>` or `tee [-a]`
 * target: `>` is diffed like a Write, `>>` appends to the file as last seen (`known`).
 */
function heredocPlanLines(cmd: string, cwd: string, known: Map<string, string>): string[] {
  const out: string[] = [];
  for (const m of cmd.matchAll(HEREDOC)) {
    const head = `${cmd.slice(0, m.index).split("\n").at(-1)} ${m[3]}`;
    const t = [...head.matchAll(/(>>?|\btee\s+(-a\s+)?)\s*(['"]?)([^\s'";|&<>]+)\3/g)].at(-1);
    if (!t) continue;
    const raw = t[4]!.replace(/^~(?=\/)/, process.env.HOME ?? "~");
    const target = isAbsolute(raw) ? raw : join(cwd, raw);
    if (!PLAN_PATH.test(target)) continue;
    const body = m[0].startsWith("<<-") ? m[4]!.replace(/^\t+/gm, "") : m[4]!;
    if (t[1] === ">" || (t[1]!.startsWith("tee") && !t[2])) { out.push(...addedPlanLines("Write", target, { content: body }, known)); continue; }
    if (known.has(target)) known.set(target, `${known.get(target)}\n${body}`);
    out.push(...body.split("\n"));
  }
  return out;
}
const unquote = (s: string) => s.replace(/^(['"])(.*)\1$/, "$2");

/**
 * Lines a Bash command likely wrote to project files, or 0. A Lead may edit through the shell
 * (`sed -i`, a heredoc script, a redirect), which no Edit/Write record shows. Where it writes is
 * read from the `cd` in force at each write, else from the paths it names, with shell variables it
 * assigns resolved. ponytail: a pattern guess, blind to `cp`/`mv`/`git checkout` and to scripts
 * that write without these calls; replace with a git-tree diff if the replay shows misses.
 */
// `cwd` is the session's directory at the call (each record carries it). Each write resolves
// against the directory in force at its position: the last `cd` before it, else `cwd`.
export function bashWriteLines(cmd: string, home = process.env.HOME ?? "", cwd = ""): number {
  const bodies: string[] = [];
  // `<<` and the tag line's tail stay: `cat <<'EOF' > src/a.ts` redirects after the tag.
  const bare = cmd.replace(HEREDOC, (_m, _q, _tag, tail: string, body: string) => {
    bodies.push(body);
    return ` << ${tail}`;
  });
  const vars = new Map<string, string>();
  for (const m of bare.matchAll(/(?:^|[\s;&(])([A-Za-z_]\w*)=("[^"]*"|'[^']*'|[^\s;&|]+)/g)) vars.set(m[1], unquote(m[2]));
  const resolve = (t: string, base: string) => {
    let out = unquote(t);
    for (let i = 0; i < 3 && /^\$/.test(out); i++) out = out.replace(/^\$\{?(\w+)\}?/, (m, v: string) => vars.get(v) ?? (v === "HOME" && home ? home : m));
    out = out.replace(/^~(?=\/|$)/, home);
    return base && !isAbsolute(out) && !out.startsWith("$") ? join(base, out) : out;
  };

  const inPlace = bare.search(/\b(sed|perl)\s+(-[a-zA-Z]*i\b|-i\b)/);
  const writesInBody = /open\([^)]*['"][wa]\+?['"]|\.write_text\(|writeFileSync|appendFileSync|Bun\.write\(/.test(cmd);
  // The interpreter that runs inline code (`python3 - <<EOF`, `bun -e`), not an earlier `bun test`.
  const inline = bare.search(/\b(python3?|bun|node|ruby)\b(?=\s+(?:-[ce]\b|-(?=\s|$)))/m);
  // The interpreter fed a heredoc (`python3 <<EOF`) first, then inline code, then the first one named.
  const fed = bare.search(/\b(python3?|bun|node|ruby)\b(?=[^;\n&|]*<<)/);
  const script = writesInBody ? [fed, inline, bare.search(/\b(python3?|bun|node|ruby)\b/)].find((i) => i >= 0) ?? -1 : -1;
  // Code passed inline (`node -e '…=>…'`, `python3 -c "a>b"`) holds `>` that is no redirect; a
  // `cd` inside `$( … )` runs in a subshell. Both are blanked, keeping the positions.
  // Quotes pair in order: a regex that may start at a closing quote spans several commands.
  const blank = (m: string) => " ".repeat(m.length);
  const shell = blankSubshells(bare).replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, (m) => (m.includes(">") ? blank(m) : m));
  // A `cd` inside `( … )` holds until the group closes; parentheses in quotes are text.
  const unquoted = blankCasePatterns(shell.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, blank));
  const cds = [...shell.matchAll(/\bcd\s+("[^"]+"|'[^']+'|[^\s;&|]+)/g)].map((m) => ({ at: m.index ?? 0, dir: m[1], until: groupEnd(unquoted, m.index ?? 0) }));
  const dirAt = (pos: number) => cds.filter((c) => c.at < pos && pos < c.until).reduce((d, c) => resolve(c.dir, d), cwd);
  const isNote = (t: string, pos: number) => isWorkingNote(resolve(t, dirAt(pos)));

  const targets = [...shell.matchAll(/(?:^|[^0-9&<>=-])>{1,2}\s*([^\s&|;<>()]+)/g), ...shell.matchAll(/\btee\s+(?:-a\s+)?([^\s&|;<>()]+)/g)];
  const redirect = targets.some((m) => !isNote(m[1], m.index ?? 0));
  // An in-place edit or script writes where its paths point, else where it runs.
  const runs = (pos: number) => {
    const tail = shell.slice(pos);
    // A quoted string with spaces is an expression or a message (`sed "s/x/$C/"`), not a path.
    const statement = tail.slice(0, tail.search(/[;\n]|&&/) + 1 || tail.length).replace(/'[^']*\s[^']*'|"[^"]*\s[^"]*"/g, "");
    const named = [statement, ...bodies.flatMap(quotedPaths).map((t) => resolve(t, dirAt(pos)))].join("\n");
    return !namedPathsAreNotes(named, (t) => resolve(t, dirAt(pos)), dirAt(pos));
  };
  if (!redirect && !(inPlace >= 0 && runs(inPlace)) && !(script >= 0 && runs(script))) return 0;
  return Math.max(5, bodies.reduce((n, b) => n + lineCount(b), 0));
}

/** Blanks each `$( … )`, nested parentheses included, so a redirect or `cd` inside it is not the command's own. */
function blankSubshells(cmd: string): string {
  let out = cmd;
  for (let i = out.indexOf("$("); i >= 0; i = out.indexOf("$(", i + 1)) {
    let depth = 0;
    let j = i + 1;
    for (; j < out.length; j++) if (out[j] === "(") depth++; else if (out[j] === ")" && --depth === 0) break;
    out = out.slice(0, i) + " ".repeat(Math.min(j, out.length - 1) - i + 1) + out.slice(j + 1);
  }
  return out;
}
// A `case` pattern's closing `)` (`case $x in a|b) …;; esac`) opens no group: blanked so a `cd`
// before the `case` still holds inside it.
const blankCasePatterns = (cmd: string) =>
  cmd.replace(/\bcase\b[\s\S]*?\besac\b/g, (block) => block.replace(/(\bin\s+|;;\s*)(\(?[^()\n;]*)\)/g, (_m, lead: string, pat: string) => `${lead}${pat} `));
/** The end of the `( … )` group a position sits in, or Infinity. `$( … )` is blanked by then. */
function groupEnd(shell: string, from: number): number {
  let depth = 0;
  for (let i = from; i < shell.length; i++) if (shell[i] === "(") depth++; else if (shell[i] === ")" && --depth < 0) return i;
  return Infinity;
}
// In a script body only quoted paths name files (`open('/r/a.py')`, `'src/a.py'`); `GET /api/a`
// in prose does not. A relative one resolves against the directory the script runs in.
const quotedPaths = (body: string) =>
  [...body.matchAll(/['"]((?:\/|~\/|\.\.\/|\$\{?\w+\}?\/|[\w.-]+\/)[^'"\s]*|[\w-]+\.[A-Za-z]\w{0,4})['"]/g)].map((m) => m[1]);

// Exempt only when every path named is an absolute working note, and it names one or runs inside one.
function namedPathsAreNotes(text: string, resolve: (t: string) => string, dir: string): boolean {
  // Relative paths that climb out (`../src/a.ts`) count too; one left unresolved (`${UNSET}/a.ts`)
  // could be anywhere: it is not a note.
  // A bare variable (`python3 - "$P"`) names a path only when it was assigned one (`P=/tmp/a.py`).
  const paths = [...text.matchAll(/(?:^|[\s="'(])((?:\/|~\/|\.\.\/|\$\{?\w+\}?\/)[^\s"';&|)]*|\$\{?[A-Za-z_]\w*\}?(?![\w/]))/g)]
    .map((m) => [m[1], resolve(m[1])])
    .filter(([raw, p]) => raw.includes("/") || p.startsWith("/"))
    .map(([, p]) => p);
  return paths.every((p) => p.startsWith("/") && isWorkingNote(p)) && (paths.length > 0 || (dir !== "" && isWorkingNote(dir)));
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((b) => (b && typeof b === "object" && (b as { type?: string }).type === "text" ? String((b as { text?: unknown }).text ?? "") : "")).join("\n");
}

const tag = (s: string, name: string): string | null => s.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? null;

/** Parses JSONL lines into ordered events of the main session (sidechains skipped). */
export function parseEvents(lines: Iterable<string>): Event[] {
  const out: Event[] = [];
  const spawns = new Map<string, Of<"spawn">>();
  const tools = new Map<string, Of<"tool">>();
  const byAgentId = new Map<string, string>();
  const planFiles = new Map<string, string>();
  const planText = new Map<string, string>();
  let idx = 0;
  for (const line of lines) {
    idx++;
    if (!line.trim()) continue;
    let r: Record<string, any>;
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    if (r.isSidechain) continue;
    if (r.type === "permission-mode" && typeof r.permissionMode === "string") {
      out.push({ kind: "mode", idx, mode: r.permissionMode });
      continue;
    }
    const content = r.message?.content;
    const message = r.type === "attachment" && r.attachment?.type === "queued_command" ? String(r.attachment.prompt ?? "") : r.type === "user" && typeof content === "string" ? content : null;
    if (message?.includes("<task-notification>")) {
      const id = tag(message, "tool-use-id");
      if (id && spawns.has(id)) out.push({ kind: "result", idx, id, status: tag(message, "status") ?? "unknown", text: tag(message, "result") ?? "" });
      continue;
    }
    const from = message?.match(/<agent-message from="([^"]+)">/)?.[1];
    if (from) {
      const id = byAgentId.get(from);
      if (id) out.push({ kind: "result", idx, id, status: "completed", text: message! });
      continue;
    }
    const queued = queuedPromptOf(r);
    const prompt = queued ?? userPromptOf(r);
    if (prompt !== null && isHumanOrigin(r)) {
      out.push(queued !== null ? { kind: "prompt", idx, text: prompt, queued: true } : { kind: "prompt", idx, text: prompt });
      continue;
    }
    const origin = r.origin?.kind ?? r.attachment?.origin?.kind;
    // Only a record delivered while idle opens a turn; a queued attachment lands mid-turn.
    if (r.type === "user" && message !== null && !r.isMeta && origin !== undefined && origin !== "human") {
      out.push({ kind: "wake", idx });
      continue;
    }
    if (r.type === "assistant" && Array.isArray(content)) {
      for (const b of content) {
        if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) out.push({ kind: "text", idx, text: b.text });
        if (b?.type !== "tool_use") continue;
        const input = (b.input ?? {}) as Record<string, unknown>;
        if (b.name === "Agent" || b.name === "Task") {
          const ev: Of<"spawn"> = { kind: "spawn", idx, id: String(b.id), type: String(input.subagent_type ?? "general-purpose"), async: false };
          spawns.set(ev.id, ev);
          out.push(ev);
        } else if (EDIT_TOOLS.has(b.name)) {
          const path = String(input.file_path ?? input.notebook_path ?? "");
          // Answer rows written into the plan count as text once the call succeeds: Leads put them
          // there, or only in thinking, far more often than in a visible message (agentic-os
          // 269e41a0, f40ab327). Adding only rows is not a plan change, so it never asks for a review.
          const added = PLAN_PATH.test(path) ? addedPlanLines(b.name, path, input, planFiles) : [];
          if (added.length) planText.set(String(b.id), added.join("\n"));
          const rowsOnly = added.length > 0 && added.every((l) => ROWS_LINE.test(l));
          if (path && !rowsOnly) out.push({ kind: "edit", idx, path, lines: editLines(b.name, input) });
        } else {
          const ev: Of<"tool"> = { kind: "tool", idx, id: String(b.id), name: String(b.name), input };
          tools.set(ev.id, ev);
          out.push(ev);
          // `cat >> plan.md <<EOF` with the rows: caseria 69a1877a answered this way, denied 4 times.
          if (b.name === "Bash" && typeof input.command === "string") {
            const rows = heredocPlanLines(input.command, typeof r.cwd === "string" ? r.cwd : "", planFiles);
            if (rows.some((l) => /^\|\s*\**H\d+/.test(l))) planText.set(ev.id, rows.join("\n"));
          }
          const written = b.name === "Bash" && typeof input.command === "string" ? bashWriteLines(input.command, undefined, typeof r.cwd === "string" ? r.cwd : "") : 0;
          if (written) out.push({ kind: "edit", idx, path: BASH_EDIT, lines: written });
        }
      }
    }
    if (r.type === "user" && Array.isArray(content)) {
      for (const b of content) {
        if (b?.type !== "tool_result") continue;
        const tool = tools.get(String(b.tool_use_id));
        if (tool) tool.ok = b.is_error !== true;
        const rows = planText.get(String(b.tool_use_id));
        if (rows !== undefined && b.is_error !== true) out.push({ kind: "text", idx, text: rows });
        const spawn = spawns.get(String(b.tool_use_id));
        if (!spawn) continue;
        const tur = r.toolUseResult && typeof r.toolUseResult === "object" ? r.toolUseResult : {};
        if (typeof tur.resolvedModel === "string") spawn.resolvedModel = tur.resolvedModel;
        if (typeof tur.agentId === "string") byAgentId.set(tur.agentId, spawn.id);
        if (tur.status === "async_launched" || tur.isAsync === true) {
          spawn.async = true;
          continue;
        }
        const text = typeof tur.handbackReport?.text === "string" ? tur.handbackReport.text : textOf(b.content);
        out.push({ kind: "result", idx, id: spawn.id, status: b.is_error ? "failed" : String(tur.status ?? "completed"), text });
      }
    }
  }
  return out;
}

export interface Review {
  id: string;
  spawnIdx: number;
  resultIdx: number;
  mode: CriticMode | null;
  reviewId: string | null;
  verdict: string;
  findings: string[];
  /** Each finding's severity and the first word of its perspective, lowercase; null when its line has none. */
  tags: Record<string, { severity: string | null; perspective: string | null }>;
  resolvedModel?: string;
  /** Findings with no `| H# |` row in the Lead's text between this delivery and the next one. */
  unanswered: string[];
  /** Findings answered ❌ with nothing that backs the dispute. */
  disputedNoEvidence: string[];
  /** Each finding with how the Lead answered it. */
  answers: ReadonlyArray<readonly [string, ReturnType<typeof answerOf>]>;
}

export const CRITIC_AGENT = "critic";

const CHOICE = /✅|❌|aceptad|disput|rechaz/i;
const DISPUTE = /❌|disput|rechaz|\bno\s+aceptad/i;
const CHOICE_WORDS = /✅|❌|\b(?:en\s+)?disput\w*|\brechaz\w*|\b(?:no\s+)?aceptad\w*/gi;

/**
 * How the Lead answered finding `h` in `text`: a row `| H1 | ✅ aceptado | fix |` or
 * `| H1 | ❌ en disputa | evidence |`, also `| **H1** |`, `| H1: claim |` or a leading id list
 * `| H9, H10 |`; never `| H10 |` for H1, nor an id that only appears in the claim. A dispute
 * needs evidence beyond the choice words, in its cell or a later one. A finding restated before
 * its answer, or answered twice, takes the last row that carries a choice.
 */
export function answerOf(h: string, text: string): "accepted" | "disputed" | "disputed-no-evidence" | null {
  const rows = [...text.matchAll(new RegExp(`^\\|\\s*\\**(?:H\\d+\\**\\s*[,/]\\s*\\**)*${h}\\b[^|\\n]*\\|([^\\n]*)$`, "gim"))];
  for (const m of rows.reverse()) {
    const cells = m[1].split("|").map((c) => c.trim());
    const at = cells.findIndex((c) => CHOICE.test(c));
    if (at < 0) continue;
    if (cells[at].includes("✅") || !DISPUTE.test(cells[at])) return "accepted";
    const rest = [cells[at].replace(CHOICE_WORDS, ""), ...cells.slice(at + 1)].join(" ");
    return /\p{L}{3}/u.test(rest) ? "disputed" : "disputed-no-evidence";
  }
  return null;
}

/**
 * Why the critic cannot run in this session, from its last spawn, or null. A session opened
 * before the agent was installed picks up new hooks live but new agents later ("not found");
 * an outage or a model fallback fails the run or serves it off-model. A run the Lead killed
 * does not count: that would let the Lead skip the review. Nor does a spawn a hook denied
 * (`PreToolUse:Agent hook error: …`, the refused brief of router/agent-hooks.ts): it never ran,
 * so the spawn before it is judged.
 */
export function criticUnavailable(events: Event[]): string | null {
  const denied = new Set(events.filter(is("result")).filter((e) => e.status === "failed" && /^PreToolUse:Agent hook /.test(e.text)).map((e) => e.id));
  const last = events.filter(is("spawn")).filter((e) => e.type === CRITIC_AGENT && !denied.has(e.id)).at(-1);
  if (!last) return null;
  const res = events.find((e): e is Of<"result"> => e.kind === "result" && e.id === last.id);
  if (res?.status === "failed" && /Agent type '[^']+' not found/.test(res.text)) return "esta sesión se abrió antes de instalar el agente `critic`; reiníciala";
  if (res?.status === "failed") return "la última ejecución del crítico falló";
  if (res && last.resolvedModel && !CRITIC_MODEL_RE.test(last.resolvedModel)) return `el crítico corrió en ${last.resolvedModel}, no en Opus`;
  return null;
}
export const CRITIC_MODEL_RE = /^claude-opus-5-5/;

/** Every delivered, completed critic review, with the findings the Lead has not answered. */
export function criticReviews(events: Event[]): Review[] {
  const spawns = new Map(events.filter(is("spawn")).filter((e) => e.type === CRITIC_AGENT).map((e) => [e.id, e]));
  const reviews: Review[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (e.kind !== "result" || e.status !== "completed" || seen.has(e.id)) continue;
    const spawn = spawns.get(e.id);
    if (!spawn) continue;
    const verdict = e.text.match(/^VERDICT:\s*(BLOCK|REVISE|PROCEED)\b/m)?.[1];
    if (!verdict) continue;
    seen.add(e.id);
    const reviewId = e.text.match(/^REVIEW-ID:\s*(\S+)/m)?.[1] ?? null;
    const prefix = reviewId?.split("-")[0];
    const mode = prefix === "plan" || prefix === "feature" || prefix === "doubt" ? prefix : null;
    // `H1 [major] [design] claim`; a line with neither tag is still a finding to answer.
    const lines = [...e.text.matchAll(/^\s*(H\d+)\s+\[(?:(blocker|major|minor)\])?(?:\s*\[([^\]\n]+)\])?/gm)];
    const findings = [...new Set(lines.map((m) => m[1]))];
    const tags = Object.fromEntries(lines.toReversed().map((m) => [m[1], { severity: m[2] ?? null, perspective: m[3]?.match(/\p{L}+/u)?.[0].toLowerCase() ?? null }]));
    // A later review reuses H1, H2…: its answers must not count for this one. A spawn that failed,
    // was killed or that a hook denied delivered no findings, so it does not close this one's answers.
    const next = events.find((x) => x.kind === "result" && x.idx > e.idx && x.id !== e.id && x.status === "completed" && spawns.has(x.id))?.idx ?? Infinity;
    const later = events.filter(is("text")).filter((x) => x.idx > e.idx && x.idx < next).map((x) => x.text).join("\n");
    const answers = findings.map((h) => [h, answerOf(h, later)] as const);
    const unanswered = answers.filter(([, a]) => a === null).map(([h]) => h);
    const disputedNoEvidence = answers.filter(([, a]) => a === "disputed-no-evidence").map(([h]) => h);
    reviews.push({ id: e.id, spawnIdx: spawn.idx, resultIdx: e.idx, mode, reviewId, verdict, findings, tags, resolvedModel: spawn.resolvedModel, unanswered, disputedNoEvidence, answers });
  }
  return reviews;
}

/** Why a review cannot count whatever the Lead answers (mode or model), or null. */
export function reviewMismatch(r: Review, mode: CriticMode): string | null {
  if (r.mode !== mode) return `its REVIEW-ID is \`${r.reviewId ?? "missing"}\`, not a \`${mode}-\` review`;
  if (!CRITIC_MODEL_RE.test(r.resolvedModel ?? "")) return `it ran on \`${r.resolvedModel ?? "an unknown model"}\`, not claude-opus-5-5`;
  return null;
}

/** Findings with no answer row or disputed without evidence, or null: rows alone fix it. */
export function rowsProblem(r: Review): string | null {
  if (r.unanswered.length) return `findings ${r.unanswered.join(", ")} have no answer row (\`| H1 | ✅ aceptado / ❌ en disputa | ... |\`)`;
  if (r.disputedNoEvidence.length) return `findings ${r.disputedNoEvidence.join(", ")} are disputed without evidence; la disputa necesita evidencia en la fila`;
  return null;
}

/** Why a review does not count for a gate, or null when it does. */
export const reviewProblem = (r: Review, mode: CriticMode) => reviewMismatch(r, mode) ?? rowsProblem(r);

/** Background spawns of any type whose result has not been delivered yet. */
export function pendingAgents(events: Event[]): string[] {
  const delivered = new Set(events.filter(is("result")).map((e) => e.id));
  return events.filter(is("spawn")).filter((e) => e.async && !delivered.has(e.id)).map((e) => e.id);
}

/** The last permission mode recorded in the transcript, if any. */
export function lastMode(events: Event[]): string | null {
  return events.filter(is("mode")).at(-1)?.mode ?? null;
}

/** Where each turn starts: a human prompt, or a plugin or peer message, delivered while idle. */
export const turnStarts = (events: Event[]) => events.filter((e) => (e.kind === "prompt" && !e.queued) || e.kind === "wake").map((e) => e.idx);

/**
 * The opt-out an orchestrator's brief carries; the model cannot write a prompt. Only the
 * session's first prompt counts, so pasting these docs or a worker log later does not disarm it.
 */
export const GATE_OFF = "[critic-gate: off]";
export const gateOptedOut = (events: Event[]) => events.find(is("prompt"))?.text?.includes(GATE_OFF) ?? false;

export { is };
