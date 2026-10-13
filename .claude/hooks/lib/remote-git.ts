// Logic of the remote-git-gate hook (entrypoint: ../remote-git-gate.ts, which loads this module
// lazily so that a failed import still fails closed).
//
// Why: permissions.ask rules prompted on every local revert (`git checkout -- f`) even in
// bypass sessions, and an ask rule can never be silenced by an explicit request: "a matching ask
// rule still prompts even when the hook returned allow" (code.claude.com/docs/en/permissions).
// Oriol's contract: local git runs freely; `git push`, `gh pr create` and `gh pr merge` need his
// this-turn ask (CLAUDE.md §Hard rules) and then run without a prompt. A force push or a remote
// branch delete needs him to say so in words; a plain "haz push" does not cover it.
//
// Both error directions are tuned to land on DENY: a false deny costs Oriol one reply, a false
// allow publishes. So detection over-matches (`echo git push` is denied). Authorization takes an
// order in the prompt, a reply that opens with assent to an offer of the action, or an
// AskUserQuestion answer that names it; never a bare mention, a quote or a question.
//
// Known holes: git aliases (`git p`), commands built at runtime or run from a script file,
// `gh api -X POST`, `gh pr close/comment`, `gh release`, `npm publish`, sessions with hooks
// disabled (`--bare`), and any agent that types into a Claude terminal: its prompt is recorded
// as human.
import { foldText } from "../skill-activation";
import { userPromptOf } from "../security-gate";
import { readTranscriptTail } from "./transcript";

export type RemoteAction = "push" | "push-force" | "pr-create" | "pr-merge";

interface Word {
  text: string; // quotes removed
  raw: boolean; // at least one unquoted character
}

const SEPARATORS = new Set([";", "&", "|", "\n", "(", ")", "{", "}"]);
const INTERPRETERS = new Set(["bash", "sh", "zsh", "dash", "ksh", "pwsh", "powershell", "cmd"]);
const EVALUATORS = new Set(["eval", "iex", "invoke-expression"]);
const REMOTE_HINT = /\bpush\b|\bgh(?:\.exe)?\b[\s\S]*\bpr\b/i;

// Left-to-right and quote-aware: stripping quoted spans with a regex loses a command after an
// apostrophe (`-m "don't" && git push … 'x'`). Returns the statements as word lists,
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
      let sub: string | undefined = words[j]?.text;
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

// An order, not a mention: "arregla el push al array", "voy a mergear" or "Explícame gh pr merge."
// must not authorize anything. Both texts are folded first (no accents, lower case), so «mérgeala»
// and «súbelo» need no accented variants. Quoted, code and pasted spans leave the prompt before
// matching. The verbs cover dictation and conjugation the user really sends: «hacer pus»,
// «abrir la PR» after another order, «mergearla», «commit y el push», «comnit push merge».
const ORDER = String.raw`(?:haz|hacer|hazme|haga|ejecuta|lanza|do|run|vamos\s+a\s+\w+)`;
const PUSH_WORD = String.raw`(?:push|pus|puch)`;
const INTENT: Record<RemoteAction, RegExp> = {
  push: new RegExp(
    [
      String.raw`\b${ORDER}\s+(?:(?:el|un|the|a)\s+)?(?:git\s+)?${PUSH_WORD}\b`,
      String.raw`\bpush(?:ea|eas|eame|ealo|eala|ealos|ealas|ear)\b`,
      String.raw`\bpush\s+(?:it|this|that|now|ya)\b`,
      String.raw`\b(?:y|e|and|then|luego)\s+(?:el\s+)?push\b`,
      String.raw`\bsube\w*\s+(?:(?:la|las|los|el)\s+)?(?:rama|cambios|commits?)\b`,
      String.raw`\bsube\w*\s+(?:a|al)\s+(?:origin|remoto|github)\b`,
    ].join("|"),
    "giu",
  ),
  "push-force": /\b(?:force[- ]push|push\s+(?:--)?force\w*|push\s+forzad[oa]|forza\w*\s+(?:el\s+)?push|fuerza\s+(?:el\s+)?push)\b|--force(?:-with-lease)?\b|\bborra\w*\s+(?:la\s+)?rama\s+remota\b|\bdelete\s+(?:the\s+)?remote\s+branch\b/giu,
  "pr-create": new RegExp(
    [
      String.raw`\b(?:crea|abre|haz|monta|create|open|make)\w*\s+(?:(?:la|una|el|the|a)\s+)?(?:pr|pull request)\b`,
      String.raw`(?:,\s*|\b(?:y|e|and|luego)\s+|\bvamos\s+a\s+)(?:abrir|crear|montar)\w*\s+(?:(?:la|una|el)\s+)?(?:pr|pull request)\b`,
    ].join("|"),
    "giu",
  ),
  "pr-merge": new RegExp(
    [
      String.raw`\b(?:mergea|fusiona|merge)\w*\s+(?:(?:la|el|esta|the|this)\s+)?(?:pr|pull request)\b`,
      String.raw`\bmergea(?:la|lo)?\b|\bmergear(?:la|lo)\b`,
      String.raw`\b(?:haz|hacer|hazme|do)\s+(?:(?:el|un|the|a)\s+)?merge\b`,
      String.raw`\bmerge\s+it\b`,
      String.raw`\b(?:y|e|and|then|luego)\s+merge\b`,
    ].join("|"),
    "giu",
  ),
};
// A list of orders headed by a commit or a push order: «haz commit, push y merge», «comnit push
// merge», «haz el push y pr». Each item counts. A list with no such head («la protección de
// push, merge») is a mention.
const LIST = new RegExp(String.raw`(?:\bcomm?n?it\w*|\b${ORDER}\s+(?:(?:el|un|the|a)\s+)?(?:git\s+)?${PUSH_WORD})(?:(?:\s*,\s*|\s+(?:y|e|and|then|luego)\s+|\s+)(?:(?:el|la|una|un)\s+)?(?:${PUSH_WORD}|pr|pull request|merge\w*)\b)+`, "giu");
const LIST_ITEM: Record<Exclude<RemoteAction, "push-force">, RegExp> = {
  push: new RegExp(String.raw`\b${PUSH_WORD}\b`, "iu"),
  "pr-create": /\b(?:pr|pull request)\b/iu,
  "pr-merge": /\bmerge/iu,
};
// What Claude offers in first person, as a question or not: «¿Hago push?», «la subo y abro la PR».
const OFFER: Record<Exclude<RemoteAction, "push-force">, RegExp> = {
  push: /\b(?:hago|hacemos|lanzo)\s+(?:(?:el|un)\s+)?push\b|\bpush(?:eo|eamos)\b|\bsubo\s+(?:(?:la|las|los|el)\s+)?(?:rama|cambios|commits?)\b|\bsubo\s+(?:a|al)\s+(?:origin|remoto|github)\b|\b(?:shall|should|can) i push\b/giu,
  "pr-create": /\b(?:abro|creo|monto|abrimos|creamos|hago)\s+(?:(?:la|una|el)\s+)?(?:pr|pull request)\b|\b(?:shall|should|can) i (?:open|create) (?:a|the) (?:pr|pull request)\b/giu,
  "pr-merge": /\b(?:mergeo|mergeamos|fusiono)\b|\bhago\s+(?:el\s+)?merge\b|\b(?:shall|should|can) i merge\b/giu,
};
// Words that name the action at all. A negated one in the prompt vetoes assent («sí, pero sin push»).
const NAMES: Record<Exclude<RemoteAction, "push-force">, RegExp> = {
  push: /\b(?:push\w*|pus|sub(?:e|ir|elo|ela|elos|elas|irlo|irla|irlos|irlas|o|amos|imos))\b/giu,
  "pr-create": /\b(?:pr|pull request)\b/giu,
  "pr-merge": /\b(?:merg\w*|fusion\w*)\b/giu,
};
// An AskUserQuestion answer made only of action words («Push y PR», «Mergear») names its choice.
const ANSWER_WORD = /^(?:push\w*|pus|sub\w*|abr\w*|cre\w*|pr|pull|request|merg\w*|fusion\w*|haz|hacer|y|e|and|then|luego|la|el|una|un|the|a|si|yes|ok|rama|cambios|ya|now)$/u;
const NEGATION_BEFORE = /\b(?:no|sin|nunca|ni|don'?t|do not|never|without|antes\s+de|todavia\s+no|aun\s+no|before|not\s+yet)\b(?:\s+\S+){0,3}\s*$/i;
const CLAUSE_START = /[\s\S]*(?:[,;.!\n]|\bpero\b|\bbut\b)/i;
const SENTENCE_START = /[\s\S]*(?:[;.!\n]|\bpero\b|\bbut\b)/i;
// «Do not comment on, approve, or merge the PR»: the negation reaches every item of an or-list.
const OR_ITEM = /(?:,\s*|\s)(?:or|nor|ni|o)\s+$/i;
const NEGATED_SENTENCE = /\b(?:no|not|don'?t|never|nunca|sin|without)\b/i;
// A question is not an order: "¿por qué hiciste push?" must not authorize one.
const QUESTIONS = /¿[^?]*\?|[^.!?\n]*\?/g;
const QUOTED = /```[\s\S]*?```|`[^`\n]*`|"[^"\n]*"|“[^”\n]*”|«[^»\n]*»|<pasted_content\b[\s\S]*?<\/pasted_content\b[^>]*>/g;
const AFFIRMATIVE = String.raw`(?:si|yes|dale|adelante|venga|vale|ok|okay|hazlo|go ahead|do it|claro|porfa|por favor|please)`;
// The reply's first clause is assent and nothing else: "sí", "sí, adelante. …", "adelante hazlo
// pero …". Not «si me refiero a…» (a conditional) nor «Sí, yo entiendo que…» (agreement).
const ASSENT = new RegExp(String.raw`^[\s¡!]*${AFFIRMATIVE}(?:[\s,!]+${AFFIRMATIVE})*[\s,!]*(?:$|[.;\n]|\b(?:pero|but)\b)`, "iu");
// «pero antes revisa…» defers everything; «pero antes de mergear» only negates the merge.
const DEFERS = /\b(?:pero|but)\s+(?:antes|primero|first)\b(?!\s+de\b)/i;

function negated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 80), index);
  if (NEGATION_BEFORE.test(before.slice(-40).replace(CLAUSE_START, ""))) return true;
  return OR_ITEM.test(before) && NEGATED_SENTENCE.test(before.replace(SENTENCE_START, ""));
}

function matches(text: string, re: RegExp): boolean {
  for (const m of text.matchAll(re)) if (!negated(text, m.index)) return true;
  return false;
}

// A list that starts a comma item inherits the sentence's negation: «Do not edit code, commit,
// push». «no pasa nada, haz commit y push» stays an order, because its item opens with a verb.
function listed(text: string, action: Exclude<RemoteAction, "push-force">): boolean {
  for (const m of text.matchAll(LIST)) {
    const before = text.slice(Math.max(0, m.index - 80), m.index);
    const item = /,\s*$/.test(before) && NEGATED_SENTENCE.test(before.replace(SENTENCE_START, ""));
    if (!item && !negated(text, m.index) && LIST_ITEM[action].test(m[0])) return true;
  }
  return false;
}

// An order for the action, from a single phrase or as an item of an order list.
function orders(text: string, action: RemoteAction): boolean {
  return matches(text, INTENT[action]) || (action !== "push-force" && listed(text, action));
}

const ordersIn = (prompt: string) => foldText(prompt).replace(QUOTED, " ").replace(QUESTIONS, " ");

export interface Turn {
  prompt: string;
  // The assistant's last text before the prompt: the offer a short "sí" answers.
  previousAssistantText: string;
  // AskUserQuestion answers given during this turn.
  answers?: string[];
}

// The prompt whose promptId is `promptId`, if a human typed it in the main thread, the assistant
// text right before it, and the AskUserQuestion answers given since. Null when that prompt is not
// (yet) in the transcript.
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
    let previousAssistantText = "";
    for (let j = i - 1; j >= 0 && !previousAssistantText; j--) {
      const a = events[j] as { type?: string; isSidechain?: boolean; message?: { content?: unknown } };
      if (a?.type !== "assistant" || a.isSidechain || !Array.isArray(a.message?.content)) continue;
      const texts = (a.message.content as Array<{ type?: string; text?: unknown }>).filter((b) => b?.type === "text" && typeof b.text === "string");
      if (texts.length) previousAssistantText = texts[texts.length - 1].text as string;
    }
    // The tool's input accepts `answers` too: a call that carried its own never reached the user.
    const answers: string[] = [];
    const prefilled = new Set<string>();
    for (const later of events.slice(i + 1)) {
      const r = later as { type?: string; promptId?: string; isSidechain?: boolean; message?: { content?: unknown }; toolUseResult?: { answers?: unknown } };
      if (r?.isSidechain || !Array.isArray(r?.message?.content)) continue;
      const blocks = r.message.content as Array<{ type?: string; id?: string; name?: string; tool_use_id?: string; input?: { answers?: unknown } }>;
      if (r.type === "assistant") {
        for (const b of blocks) if (b?.type === "tool_use" && b.name === "AskUserQuestion" && b.input?.answers && Object.keys(b.input.answers).length) prefilled.add(b.id ?? "");
        continue;
      }
      const given = r.promptId === promptId ? r.toolUseResult?.answers : undefined;
      const call = blocks.find((b) => b?.type === "tool_result")?.tool_use_id ?? "";
      if (given && typeof given === "object" && !prefilled.has(call)) answers.push(...Object.values(given).filter((v): v is string => typeof v === "string"));
    }
    return answers.length ? { prompt, previousAssistantText, answers } : { prompt, previousAssistantText };
  }
  return null;
}

function assents(turn: Turn, action: Exclude<RemoteAction, "push-force">): boolean {
  const prompt = foldText(turn.prompt);
  if (!ASSENT.test(prompt) || DEFERS.test(prompt)) return false;
  for (const m of prompt.matchAll(NAMES[action])) if (negated(prompt, m.index)) return false;
  // The offer often sits in quotes («responde "abre la PR"»), so quotes stay here.
  const offer = foldText(turn.previousAssistantText);
  return orders(offer, action) || matches(offer, OFFER[action]);
}

function answered(answer: string, action: RemoteAction): boolean {
  const text = ordersIn(answer.replace(/\([^)]*\)/g, " "));
  if (orders(text, action)) return true;
  if (action === "push-force") return false;
  const words = text.split(/[\s,+&/.!]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => ANSWER_WORD.test(w)) && matches(text, NAMES[action]);
}

function asks(turn: Turn, action: RemoteAction): boolean {
  if (orders(ordersIn(turn.prompt), action)) return true;
  if ((turn.answers ?? []).some((a) => answered(a, action))) return true;
  return action !== "push-force" && assents(turn, action);
}

// A merge covers its PR only when the ask has PR shape: «mergea la PR», or merge as an item of
// «haz commit, push y merge». «mergea dev en mi rama» is a local merge and publishes nothing.
function mergesItsPr(turn: Turn): boolean {
  const text = ordersIn(turn.prompt);
  return asks(turn, "pr-merge") && (matches(text, NAMES["pr-create"]) || listed(text, "pr-merge"));
}

// Pure. Did this turn authorize the action? A PR needs its branch on the remote and a merge
// needs its PR, so a bigger ask covers the smaller step. A force push is never implied.
export function authorized(turn: Turn, action: RemoteAction): boolean {
  if (asks(turn, action)) return true;
  if (action === "push") return authorized(turn, "pr-create");
  if (action === "pr-create") return mergesItsPr(turn);
  return false;
}

const LABEL: Record<RemoteAction, string> = { push: "git push", "push-force": "a force push or remote branch delete", "pr-create": "gh pr create", "pr-merge": "gh pr merge" };

function denialReason(missing: RemoteAction[]): string {
  const names = missing.map((a) => LABEL[a]).join(", ");
  return `${names} publishes to the remote and the user did not ask for it in this turn's message (CLAUDE.md §Hard rules). Do not retry it in another form. Stop and ask the user, in chat or with AskUserQuestion; it runs once he asks for it in any wording that names the action ("haz push", "abre la PR", "mergea la PR"), says "sí" to your offer, or picks an answer that names it. A force push always needs the words ("haz push --force").`;
}

const SUBAGENT_REASON = "Remote git (push, PR create/merge) never runs inside a subagent: its prompt comes from the Lead, not from the user. Report back and let the Lead run it after the user asks.";

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
