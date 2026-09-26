#!/usr/bin/env bun

// PreToolUse (Bash|PowerShell) — remote git actions run only when Oriol asked for them this turn.
//
// 2026-09-26: permissions.ask rules prompted on every local revert (`git checkout -- f`) even in
// bypass sessions, and an ask rule can never be silenced by an explicit request: "a matching ask
// rule still prompts even when the hook returned allow" (code.claude.com/docs/en/permissions).
// Oriol's contract: local git runs freely; `git push`, `gh pr create` and `gh pr merge` need his
// this-turn ask (CLAUDE.md §Git / PR) and then run without a prompt. A force push or a remote
// branch delete needs him to say so in words; a plain "haz push" does not cover it.
//
// The hook BLOCKS with exit 2 rather than asking: a hook "ask" is not on the "actions no mode
// auto-approves" list, so bypassPermissions may skip it, and exit 2 stops the call before any
// other hook's or rule's allow counts. It fails CLOSED: the prompt must be the one whose
// `promptId` matches this call's `prompt_id`, typed by a human, in the main thread. The docs warn
// the transcript "may not yet include the current turn's most recent messages", so a missing
// prompt is re-read briefly, then denied. Subagents never publish. Known holes: aliases
// (`git p`), commands built at runtime, and sessions with hooks disabled (`--bare`).
import { readHookStdin } from "./lib/hook-stdin";
import { readTranscriptTail, splitStatements, stripShellData, userPromptOf } from "./security-gate";

export type RemoteAction = "push" | "push-force" | "pr-create" | "pr-merge";

const LEAD = String.raw`(?:^|[\s;&|(\x60{])`;
const PUSH_RE = new RegExp(String.raw`${LEAD}git(?:\.exe)?\s+(?:(?:-C|-c|--git-dir|--work-tree|--namespace)(?:=|\s+)\S+\s+|--no-pager\s+|-P\s+)*push\b`);
// Rewrites or deletes remote history: --force, -f, --force-with-lease, --mirror, --delete, -d,
// --prune, a `+refspec` or a `:branch` delete refspec.
const FORCE_RE = /\s(?:--force(?:-with-lease|-if-includes)?(?:=\S+)?|--mirror|--delete|--prune|-(?!-)[a-zA-Z]*[fd][a-zA-Z]*|\+\S+|:\S+)(?=\s|$)/;
const GH_PR_RE = new RegExp(String.raw`${LEAD}gh(?:\.exe)?\s+(?:(?:-R|--repo)(?:=|\s+)\S+\s+)*pr\s+(create|merge)\b`, "g");

// Quoted spans are data (`grep "git push"`), except the body of `bash -c "…"`, `eval "…"` and
// `$(…)`, which run. Those bodies are scanned too: a missed push costs more than a false deny.
function commandTexts(command: string): string[] {
  const texts = [stripShellData(command)];
  const inner = /\b(?:bash|sh|zsh|dash|pwsh|powershell|cmd)(?:\.exe)?\b[^|;&\n]*?\s(?:-c|-Command|\/c)\s+(["'])((?:\\.|(?!\1)[^\\])*)\1|\beval\s+(["'])((?:\\.|(?!\3)[^\\])*)\3/gi;
  for (const m of command.matchAll(inner)) texts.push(stripShellData((m[2] ?? m[4]).replace(/\\(["'])/g, "$1")));
  for (const m of command.matchAll(/\$\(([^()]*)\)/g)) texts.push(stripShellData(m[1]));
  return texts;
}

// Pure. Which remote actions does this shell command perform?
export function remoteActions(command: string): RemoteAction[] {
  const found = new Set<RemoteAction>();
  for (const text of commandTexts(command)) {
    for (const statement of splitStatements(text)) {
      const push = PUSH_RE.exec(statement);
      if (push) found.add(FORCE_RE.test(statement.slice(push.index + push[0].length)) ? "push-force" : "push");
      for (const m of statement.matchAll(GH_PR_RE)) found.add(m[1] === "create" ? "pr-create" : "pr-merge");
    }
  }
  return [...found];
}

// An order, not a mention: "arregla el test de git push" must not authorize a push.
const PUSH_ORDER = String.raw`\b(?:haz|hacer|hazme|haga|ejecuta|lanza|do|run)\s+(?:(?:el|un|the|a)\s+)?(?:git\s+)?push\b|\bpush(?:ea|eas|eo|eame|ealo|eala|ear|éalo|éala)\b|\bpush\s+(?:it|this|that|now|ya|la|el|los|las|a|al|to)\b|(?:^|[.!,;\n]\s*|\s(?:y|e|and|then|luego)\s+)push\b|\bs[uú]be\w*\s+(?:(?:la|las|los|el)\s+)?(?:rama|cambios|commits?)\b|\bs[uú]be\w*\s+(?:a|al)\s+(?:origin|remoto|github)\b`;
const INTENT: Record<RemoteAction, RegExp> = {
  push: new RegExp(PUSH_ORDER, "gi"),
  "push-force": /\b(?:force[- ]push|push\s+(?:--)?force\w*|push\s+forzad[oa]|forza\w*\s+(?:el\s+)?push|fuerza\s+(?:el\s+)?push|--force(?:-with-lease)?)\b|\bborra\w*\s+(?:la\s+)?rama\s+remota\b|\bdelete\s+(?:the\s+)?remote\s+branch\b/gi,
  "pr-create": /\b(?:crea|creo|abre|abro|haz|hago|monta|monto|create|open|make)\w*\s+(?:(?:la|una|el|the|a)\s+)?(?:pr|pull request)\b|\bgh pr create\b/gi,
  "pr-merge": /\b(?:mergea|mergeo|fusiona|fusiono|merge)\w*\s+(?:(?:la|el|esta|the|this)\s+)?(?:pr|pull request)\b|\bgh pr merge\b/gi,
};
// What an assistant question must name for a bare "sí" to answer it.
const QUESTION_MENTION: Record<RemoteAction, RegExp> = {
  push: /\bpush\w*|\bs[uú]b[eo]\w*/i,
  "push-force": /\bforce\w*|\bforz\w*|\brama remota\b|\bremote branch\b/i,
  "pr-create": /\b(?:abr|cre|mont|open|create)\w*\s+(?:(?:la|una|el|the|a)\s+)?(?:pr|pull request)\b/i,
  "pr-merge": /\bmerge\w*|\bfusion\w*/i,
};
const NEGATION_BEFORE = /\b(?:no|sin|nunca|ni|don'?t|do not|never|without)\b(?:\s+\S+){0,3}\s*$/i;
// A question is not an order: "¿por qué hiciste push?" must not authorize one.
const QUESTIONS = /¿[^?]*\?|[^.!?\n]*\?/g;
// `\b` is ASCII-only in JavaScript and never fires after "í"; a Unicode lookahead does.
const AFFIRMATIVE = /^\s*(?:s[ií]|yes|dale|adelante|venga|vale|ok|okay|hazlo|go ahead|do it)(?!\p{L})/iu;

function asksFor(text: string, action: RemoteAction): boolean {
  const orders = text.replace(QUESTIONS, " ");
  for (const m of orders.matchAll(INTENT[action])) {
    if (!NEGATION_BEFORE.test(orders.slice(Math.max(0, m.index - 40), m.index))) return true;
  }
  return false;
}

function questionNames(text: string, action: RemoteAction): boolean {
  return (text.match(QUESTIONS) ?? []).some((q) => QUESTION_MENTION[action].test(q));
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
  if (asksFor(turn.prompt, action)) return true;
  return turn.prompt.trim().length <= 60 && AFFIRMATIVE.test(turn.prompt) && questionNames(turn.previousAssistantText, action);
}

const LABEL: Record<RemoteAction, string> = { push: "git push", "push-force": "a force push or remote branch delete", "pr-create": "gh pr create", "pr-merge": "gh pr merge" };

export function denialReason(missing: RemoteAction[]): string {
  const names = missing.map((a) => LABEL[a]).join(", ");
  return `${names} publishes to the remote and Oriol did not ask for it in this turn's message (CLAUDE.md §Git / PR). Do not retry it in another form. Stop and ask him in a plain chat message; it runs once he replies asking for it ("haz push", "abre la PR", "haz push --force") or answers your question with a plain "sí".`;
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

// The transcript is written asynchronously: re-read for up to ~2 s before giving up.
async function readTurnWithRetry(path: string, promptId: string): Promise<Turn | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    // 2 MB, not the Stop gate's 256 KB: a long turn's tool output can push the prompt past a
    // short tail. Read only for remote commands.
    const turn = extractTurn(await readTranscriptTail(path, 2 * 1024 * 1024), promptId);
    if (turn) return turn;
    await Bun.sleep(250);
  }
  return null;
}

if (import.meta.main) {
  let reason: string | null = null;
  try {
    const raw = await readHookStdin();
    const payload = JSON.parse(raw) as { tool_name?: string; tool_input?: { command?: unknown }; transcript_path?: unknown; prompt_id?: unknown; agent_id?: unknown };
    const command = payload.tool_input?.command;
    if ((payload.tool_name === "Bash" || payload.tool_name === "PowerShell") && typeof command === "string") {
      const { transcript_path: path, prompt_id: promptId } = payload;
      if (payload.agent_id && remoteActions(command).length) reason = SUBAGENT_REASON;
      else reason = await judge(command, async () => (typeof path === "string" && path && typeof promptId === "string" && promptId ? readTurnWithRetry(path, promptId) : null));
    }
  } catch {
    // an unparseable payload names no command to judge
  }
  if (reason) {
    process.stderr.write(reason + "\n");
    process.exit(2);
  }
  process.exit(0);
}
