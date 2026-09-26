// Logic of the remote-git-gate hook (entrypoint: ../remote-git-gate.ts, which loads this module
// lazily so that a failed import still fails closed).
//
// 2026-09-26: permissions.ask rules prompted on every local revert (`git checkout -- f`) even in
// bypass sessions, and an ask rule can never be silenced by an explicit request: "a matching ask
// rule still prompts even when the hook returned allow" (code.claude.com/docs/en/permissions).
// Oriol's contract: local git runs freely; `git push`, `gh pr create` and `gh pr merge` need his
// this-turn ask (CLAUDE.md §Git / PR) and then run without a prompt. A force push or a remote
// branch delete needs him to say so in words; a plain "haz push" does not cover it.
//
// Both error directions are tuned to land on DENY: a false deny costs Oriol one reply, a false
// allow publishes. So detection over-matches (`echo git push` is denied) and authorization
// under-matches (only order forms count, never a mention, a quote or a question).
//
// Known holes: git aliases (`git p`), commands built at runtime or run from a script file,
// `gh api -X POST`, `gh pr close/comment`, `gh release`, `npm publish`, sessions with hooks
// disabled (`--bare`), and any agent that types into a Claude terminal: its prompt is recorded
// as human. Orca dispatch prompts are recognised by their preamble and never authorize.
// ponytail: this module and security-gate.ts keep separate git vocabularies (the Stop warn vs
// this gate); merge them when a third hook needs remote-git detection.
import { readTranscriptTail, userPromptOf } from "../security-gate";

export type RemoteAction = "push" | "push-force" | "pr-create" | "pr-merge";

interface Word {
  text: string; // quotes removed
  raw: boolean; // at least one unquoted character
}

const SEPARATORS = new Set([";", "&", "|", "\n", "(", ")", "{", "}"]);
const INTERPRETERS = new Set(["bash", "sh", "zsh", "dash", "ksh", "pwsh", "powershell", "cmd"]);
const EVALUATORS = new Set(["eval", "iex", "invoke-expression"]);
const REMOTE_HINT = /\bpush\b|\bgh(?:\.exe)?\b[\s\S]*\bpr\b/i;

// Left-to-right and quote-aware, unlike stripShellData, whose quote stripping loses a command
// after an apostrophe (`-m "don't" && git push … 'x'`). Returns the statements as word lists,
// plus text that a shell will execute later: `$(…)` or backticks inside double quotes,
// backtick spans, and heredoc bodies.
function tokenize(command: string): { statements: Word[][]; nested: string[] } {
  const nested: string[] = [];
  const src = extractHeredocs(command.replace(/\r\n/g, "\n").replace(/\\\n|`\n/g, " "), nested);
  const statements: Word[][] = [];
  let words: Word[] = [];
  let text = "";
  let raw = false;
  let inWord = false;
  const endWord = () => {
    if (inWord) words.push({ text, raw });
    text = "";
    raw = false;
    inWord = false;
  };
  const endStatement = () => {
    endWord();
    if (words.length) statements.push(words);
    words = [];
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === " " || c === "\t") endWord();
    else if (SEPARATORS.has(c)) endStatement();
    else if (c === "'" || c === '"') {
      const close = src.indexOf(c, i + 1);
      const end = close === -1 ? src.length : close;
      const body = src.slice(i + 1, end);
      if (c === '"' && /\$\(|`/.test(body)) nested.push(...substitutions(body));
      text += body;
      inWord = true;
      i = end;
    } else if (c === "`") {
      const close = src.indexOf("`", i + 1);
      if (close === -1) continue;
      nested.push(src.slice(i + 1, close));
      endStatement();
      i = close;
    } else if (c === "\\" && i + 1 < src.length && !/[A-Za-z0-9]/.test(src[i + 1])) {
      // An escape, but never before a letter: `C:\tools\git.exe` is a PowerShell path.
      text += src[++i];
      raw = inWord = true;
    } else {
      text += c;
      raw = inWord = true;
    }
  }
  endStatement();
  return { statements, nested };
}

// A backslash-escaped backtick inside double quotes is a literal, not a substitution.
function substitutions(body: string): string[] {
  return [...body.matchAll(/\$\(([\s\S]*?)\)|(?<!\\)`([\s\S]*?)(?<!\\)`/g)].map((m) => m[1] ?? m[2]);
}

// A heredoc body is data (`cat <<EOF`) unless it feeds a shell; either way it leaves the command
// text, and the body goes to `nested` when its opening line names an interpreter. Without a
// closing delimiter (`$((1<<x))`) nothing is removed.
function extractHeredocs(src: string, nested: string[]): string {
  const lines = src.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const m = /<<(-?)\s*(['"]?)([A-Za-z_][\w.-]*)\2/.exec(lines[i].replace(/<<</g, ""));
    if (!m) continue;
    let end = i + 1;
    while (end < lines.length && (m[1] ? lines[end].trim() : lines[end]) !== m[3]) end++;
    if (end === lines.length) continue;
    const feedsShell = lines[i].split(/[\s|;&(]+/).some((w) => INTERPRETERS.has(commandName(w)) || EVALUATORS.has(commandName(w)));
    if (feedsShell) nested.push(lines.slice(i + 1, end).join("\n"));
    i = end;
  }
  return out.join("\n");
}

// `\git`, `C:/Program Files/Git/cmd/git.exe` and `GIT` all run git.
function commandName(word: string): string {
  return word.replace(/^\\/, "").split(/[\\/]/).pop()!.replace(/\.exe$/i, "").toLowerCase();
}

const GIT_VALUE_OPTIONS = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env", "--super-prefix"]);
const FORCE_WORD = /^(?:--force(?:-with-lease|-if-includes)?(?:=.*)?|--mirror|--delete|--prune|-(?!-)[a-zA-Z]*[fd][a-zA-Z]*|\+.+|:.+)$/;
// `git -c remote.origin.push=+refs/heads/*:refs/heads/*` or `remote.x.mirror=true` rewrite history.
const FORCE_CONFIG = /^remote\..+\.(?:push=\+|mirror=)/i;

// The actions of one statement, reading from every word that runs git or gh. The subcommand is
// the first non-option word after the global options, so a quoted `"push"` still counts and
// `git commit -m 'push the button'` does not.
function statementActions(words: Word[], found: Set<RemoteAction>): void {
  for (let i = 0; i < words.length; i++) {
    const name = commandName(words[i].text);
    if (name === "git") {
      let force = false;
      let j = i + 1;
      for (; j < words.length && words[j].text.startsWith("-"); j++) {
        if (GIT_VALUE_OPTIONS.has(words[j].text)) {
          if (words[j].text === "-c" && FORCE_CONFIG.test(words[j + 1]?.text ?? "")) force = true;
          j++;
        }
      }
      let sub = words[j]?.text;
      if (sub === "subtree") sub = words.slice(j + 1).find((w) => !w.text.startsWith("-"))?.text;
      if (sub !== "push") continue;
      if (force || words.slice(j + 1).some((w) => FORCE_WORD.test(w.text) || FORCE_CONFIG.test(w.text))) found.add("push-force");
      else found.add("push");
    } else if (name === "gh") {
      const rest = words.slice(i + 1).map((w) => w.text);
      const plain = rest.filter((w, k) => !w.startsWith("-") && !/^(?:-R|--repo)$/.test(rest[k - 1] ?? ""));
      if (plain[0] !== "pr") continue;
      if (plain[1] === "create" || plain[1] === "new") found.add("pr-create");
      if (plain[1] === "merge") found.add("pr-merge");
    }
  }
}

// Pure. Which remote actions does this shell command perform?
export function remoteActions(command: string, depth = 0): RemoteAction[] {
  const found = new Set<RemoteAction>();
  const { statements, nested } = tokenize(command);
  for (const words of statements) {
    statementActions(words, found);
    // `bash -c "…"`, `pwsh -Command "…"`, `cmd /c …`, `eval "…"`, `iex '…'` run their argument.
    for (let i = 0; i < words.length; i++) {
      const name = commandName(words[i].text);
      if (EVALUATORS.has(name)) nested.push(words.slice(i + 1).map((w) => w.text).join(" "));
      if (INTERPRETERS.has(name)) {
        const flag = words.findIndex((w, k) => k > i && /^(?:-[a-z]*c|-command|\/c)$/i.test(w.text));
        if (flag !== -1) nested.push(words.slice(flag + 1).map((w) => w.text).join(" "));
      }
    }
  }
  for (const body of nested) {
    const inner = depth < 3 ? remoteActions(body, depth + 1) : [];
    for (const a of inner) found.add(a);
    // Too deep or unparsed but remote-looking: demand the strictest wording.
    if (!inner.length && REMOTE_HINT.test(body)) found.add("push-force");
  }
  return [...found];
}

// An order, not a mention: "arregla el push al array" or "Explícame gh pr merge." must not
// authorize anything. Quoted and code spans are removed before matching.
const INTENT: Record<RemoteAction, RegExp> = {
  push: new RegExp(
    [
      String.raw`\b(?:haz|hacer|hazme|haga|ejecuta|lanza|do|run)\s+(?:(?:el|un|the|a)\s+)?(?:git\s+)?push\b`,
      String.raw`\bpush(?:ea|eas|eame|ealo|eala|ealos|ealas|ear|éalo|éala|éalos|éalas)\b`,
      String.raw`\bpush\s+(?:it|this|that|now|ya)\b`,
      String.raw`\bcommit\w*\s*(?:,\s*|\s+(?:y|e|and|then|luego)\s+|\s+)push\b`,
      String.raw`\b(?:y|e|and|then|luego)\s+push\b`,
      String.raw`\bs[uú]be\w*\s+(?:(?:la|las|los|el)\s+)?(?:rama|cambios|commits?)\b`,
      String.raw`\bs[uú]be\w*\s+(?:a|al)\s+(?:origin|remoto|github)\b`,
    ].join("|"),
    "giu",
  ),
  "push-force": /\b(?:force[- ]push|push\s+(?:--)?force\w*|push\s+forzad[oa]|forza\w*\s+(?:el\s+)?push|fuerza\s+(?:el\s+)?push)\b|--force(?:-with-lease)?\b|\bborra\w*\s+(?:la\s+)?rama\s+remota\b|\bdelete\s+(?:the\s+)?remote\s+branch\b/giu,
  "pr-create": /\b(?:crea|abre|haz|monta|create|open|make)\w*\s+(?:(?:la|una|el|the|a)\s+)?(?:pr|pull request)\b/giu,
  "pr-merge": new RegExp(
    [
      String.raw`\b(?:mergea|fusiona|merge)\w*\s+(?:(?:la|el|esta|the|this)\s+)?(?:pr|pull request)\b`,
      String.raw`\bmerg(?:e|é)a(?:la|lo)?\b`,
      String.raw`\b(?:haz|hacer|hazme|do)\s+(?:(?:el|un|the|a)\s+)?merge\b`,
      String.raw`\bmerge\s+it\b`,
      String.raw`\b(?:y|e|and|then|luego)\s+merge\b`,
    ].join("|"),
    "giu",
  ),
};
// A question Claude asked, in first person, that a bare "sí" answers: "¿Hago push?", "¿Abro la PR?".
const PUSH_QUESTION = String.raw`\b(?:hago|hacemos|lanzo)\s+(?:(?:el|un)\s+)?push\b|\bpush(?:eo|eamos)\b|\bs[uú]bo\s+(?:(?:la|las|los|el)\s+)?(?:rama|cambios|commits?)\b|\bs[uú]bo\s+(?:a|al)\s+(?:origin|remoto|github)\b|\b(?:shall|should|can) I push\b`;
const QUESTION_ORDER: Record<RemoteAction, (q: string) => boolean> = {
  push: (q) => new RegExp(PUSH_QUESTION, "iu").test(q),
  "push-force": (q) => (new RegExp(PUSH_QUESTION, "iu").test(q) && /force|forz/i.test(q)) || /\bborro\s+(?:la\s+)?rama\s+remota\b/i.test(q),
  "pr-create": (q) => /\b(?:abro|creo|monto|abrimos|creamos|hago)\s+(?:(?:la|una|el)\s+)?(?:pr|pull request)\b|\b(?:shall|should|can) I (?:open|create) (?:a|the) (?:pr|pull request)\b/iu.test(q),
  "pr-merge": (q) => /\b(?:mergeo|mergeamos|fusiono)\b|\bhago\s+(?:el\s+)?merge\b|\b(?:shall|should|can) I merge\b/iu.test(q),
};
const NEGATION_BEFORE = /\b(?:no|sin|nunca|ni|don'?t|do not|never|without)\b(?:\s+\S+){0,3}\s*$/i;
const CLAUSE_START = /[\s\S]*(?:[,;.!\n]|\bpero\b|\bbut\b)/i;
// A question is not an order: "¿por qué hiciste push?" must not authorize one.
const QUESTIONS = /¿[^?]*\?|[^.!?\n]*\?/g;
const QUOTED = /```[\s\S]*?```|`[^`\n]*`|"[^"\n]*"|“[^”\n]*”|«[^»\n]*»/g;
const AFFIRMATIVE = String.raw`(?:s[ií]|yes|dale|adelante|venga|vale|ok|okay|hazlo|go ahead|do it|claro|porfa|por favor|please)`;
// The whole reply is assent and nothing else: "sí", "sí, adelante", "dale!". Not "sí, pero no hagas push".
const ONLY_AFFIRMATIVE = new RegExp(String.raw`^[\s¡!]*${AFFIRMATIVE}(?:[\s,!.]+${AFFIRMATIVE})*[\s,!.]*$`, "iu");
const ORCA_DISPATCH = /You are a dispatched worker|--dispatch-capability/;

function negated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 40), index).replace(CLAUSE_START, "");
  return NEGATION_BEFORE.test(before);
}

function asksFor(text: string, action: RemoteAction): boolean {
  const orders = text.replace(QUOTED, " ").replace(QUESTIONS, " ");
  for (const m of orders.matchAll(INTENT[action])) if (!negated(orders, m.index)) return true;
  return false;
}

function questionOrders(text: string, action: RemoteAction): boolean {
  const spans = text.replace(QUOTED, " ").match(QUESTIONS) ?? [];
  return spans.some((q) => QUESTION_ORDER[action](q) && !/\b(?:no|sin|without|not)\b/i.test(q));
}

export interface Turn {
  prompt: string;
  // The assistant's last text before the prompt: a "¿Hago push?" that a short "sí" answers.
  previousAssistantText: string;
}

// The prompt whose promptId is `promptId`, if a human typed it in the main thread, and the
// assistant text right before it. Null when that prompt is not (yet) in the transcript.
export function extractTurn(jsonl: string, promptId: string): Turn | null {
  const events: unknown[] = [];
  for (const line of jsonl.split("\n")) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // a cut first line or a partial write
    }
  }
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i] as { promptId?: string; isSidechain?: boolean; origin?: { kind?: string } };
    if (e?.promptId !== promptId || e.isSidechain || (e.origin && e.origin.kind !== "human")) continue;
    const prompt = userPromptOf(events[i]);
    if (prompt === null) continue;
    for (let j = i - 1; j >= 0; j--) {
      const a = events[j] as { type?: string; isSidechain?: boolean; message?: { content?: unknown } };
      if (a?.type !== "assistant" || a.isSidechain || !Array.isArray(a.message?.content)) continue;
      const texts = (a.message.content as Array<{ type?: string; text?: unknown }>).filter((b) => b?.type === "text" && typeof b.text === "string");
      if (texts.length) return { prompt, previousAssistantText: texts[texts.length - 1].text as string };
    }
    return { prompt, previousAssistantText: "" };
  }
  return null;
}

// Pure. Did this turn authorize the action?
export function authorized(turn: Turn, action: RemoteAction): boolean {
  // An Orca coordinator typed this into a worker terminal; workers never publish.
  if (ORCA_DISPATCH.test(turn.prompt)) return false;
  if (asksFor(turn.prompt, action)) return true;
  return ONLY_AFFIRMATIVE.test(turn.prompt) && questionOrders(turn.previousAssistantText, action);
}

const LABEL: Record<RemoteAction, string> = { push: "git push", "push-force": "a force push or remote branch delete", "pr-create": "gh pr create", "pr-merge": "gh pr merge" };

export function denialReason(missing: RemoteAction[]): string {
  const names = missing.map((a) => LABEL[a]).join(", ");
  return `${names} publishes to the remote and Oriol did not ask for it in this turn's message (CLAUDE.md §Git / PR). Do not retry it in another form. Stop and ask him in a plain chat message (an AskUserQuestion answer does not count); it runs once he replies asking for it ("haz push", "abre la PR", "mergea la PR", "haz push --force") or answers your question with a plain "sí".`;
}

export const SUBAGENT_REASON = "Remote git (push, PR create/merge) never runs inside a subagent: its prompt comes from the Lead, not from Oriol. Report back and let the Lead run it after Oriol asks.";

// Pure. The hook's verdict for one command, given a way to read the turn.
export async function judge(command: string, readTurn: () => Promise<Turn | null>): Promise<string | null> {
  const actions = remoteActions(command);
  if (actions.length === 0) return null;
  let turn: Turn | null = null;
  try {
    turn = await readTurn();
  } catch {
    turn = null; // fail closed below
  }
  const missing = turn ? actions.filter((a) => !authorized(turn, a)) : actions;
  return missing.length ? denialReason(missing) : null;
}

// The transcript is written asynchronously: re-read for up to ~2 s before giving up. The last
// attempt reads a 16 MB tail, for a turn whose tool output pushed the prompt past 2 MB.
async function readTurnWithRetry(path: string, promptId: string): Promise<Turn | null> {
  const ATTEMPTS = 8;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const bytes = attempt === ATTEMPTS - 1 ? 16 * 1024 * 1024 : 2 * 1024 * 1024;
    const turn = extractTurn(await readTranscriptTail(path, bytes), promptId);
    if (turn) return turn;
    if (attempt < ATTEMPTS - 1) await Bun.sleep(250);
  }
  return null;
}

const SHELL_TOOLS = new Set(["Bash", "PowerShell", "Monitor"]);

// The whole hook for one raw stdin payload: a denial reason, or null to let the call run.
// Throws on a malformed payload; the entrypoint turns any throw into a fail-closed verdict.
export async function gateVerdict(rawPayload: string): Promise<string | null> {
  const payload = JSON.parse(rawPayload) as { tool_name?: string; tool_input?: { command?: unknown }; transcript_path?: unknown; prompt_id?: unknown; agent_id?: unknown };
  const command = payload.tool_input?.command;
  if (!SHELL_TOOLS.has(payload.tool_name ?? "") || typeof command !== "string") return null;
  if (payload.agent_id && remoteActions(command).length) return SUBAGENT_REASON;
  const { transcript_path: path, prompt_id: promptId } = payload;
  return judge(command, async () => (typeof path === "string" && path && typeof promptId === "string" && promptId ? readTurnWithRetry(path, promptId) : null));
}
