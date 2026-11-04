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
// Known holes: git and gh aliases defined before the session (`git p`), commands built in an
// earlier call or run from a script file or another language, a command handed as quoted text to
// a shell, a wrapper or a git setting (`echo … | sh`, `env -S`, `-c core.pager=`; the common shapes
// are denied under a factory grant), git options that run a command (`git grep -O`, `--upload-pack`),
// `GIT_*` command variables, names built at run time (`${IFS}`, `$(printf …)`), `gh api` writes other than a merge,
// `gh pr close/comment`, `gh release`, `npm publish`, sessions with hooks disabled (`--bare`), and
// any agent that types into a Claude terminal: its prompt is recorded as human.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { factoryGrant, type Grant } from "./factory-grant";
import { foldText } from "./language";
import { learnedLog } from "./paths";
import { isHumanOrigin, readTranscriptTail, userPromptOf } from "./transcript";

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

// `\git`, `C:/Program Files/Git/cmd/git.exe` and `GIT` all run git, and bash runs `g\h` as gh.
function commandName(word: string): string {
  const bare = word.replace(/\\/g, "").toLowerCase();
  if (bare === "git" || bare === "gh") return bare;
  return word.replace(/^\\/, "").split(/[\\/]/).pop()!.replace(/\.exe$/i, "").toLowerCase();
}

const ASSIGNMENT = /^[A-Za-z_]\w*=/;

// The word a statement runs: the first one after its `VAR=value` prefix.
function commandIndex(words: Word[]): number {
  let i = 0;
  while (i < words.length && words[i].raw && ASSIGNMENT.test(words[i].text)) i++;
  return i;
}

// The value of `--name=x`, `-nx`, `-n=x`, or of `-n x` / `--name x` (then the next word is consumed).
function optionValue(rest: string[], k: number, names: string[]): [value: string | undefined, consumed: number] {
  const word = rest[k];
  for (const n of names) {
    if (word === n) return [rest[k + 1], 1];
    if (n.startsWith("--") ? word.startsWith(`${n}=`) : word.startsWith(n)) return [word.slice(n.length).replace(/^=/, ""), 0];
  }
  return [undefined, 0];
}

// `gh api` writes when its method is not GET or it sends fields, a body or a GraphQL query.
function apiWrites(rest: string[]): boolean {
  for (let k = 0; k < rest.length; k++) {
    const [method] = optionValue(rest, k, ["-X", "--method"]);
    if (method !== undefined && method.toUpperCase() !== "GET") return true;
    if (/^(?:-[fF]|--field|--raw-field|--input)/.test(rest[k]) || rest[k] === "graphql") return true;
  }
  return false;
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
      // A merge through the API (`…/merge`, `mergePullRequest`) is a merge.
      if (plain[0] === "api" && apiWrites(rest) && rest.some((w) => /\/merge\/?$|merge\w*pullrequest|pullrequestautomerge/i.test(w))) found.add("pr-merge");
      if (plain[0] !== "pr") continue;
      if (plain[1] === "create" || plain[1] === "new") found.add("pr-create");
      if (plain[1] === "merge") found.add("pr-merge");
    }
  }
}

// An alias body: `!cmd` runs in a shell, anything else is a subcommand of `tool`.
const aliasBody = (tool: string, value: string) => (value.startsWith("!") ? value.slice(1) : `${tool} ${value}`);

// Commands git itself runs: alias definitions (`-c alias.x=…`, `git config alias.x …`),
// `submodule foreach`, `rebase --exec` and `bisect run`.
function gitNested(words: Word[], i: number, nested: string[]): void {
  let j = i + 1;
  for (; j < words.length && words[j].text.startsWith("-"); j++) {
    if (!GIT_VALUE_OPTIONS.has(words[j].text)) continue;
    const alias = words[j].text === "-c" ? /^alias\.[^=]+=([\s\S]*)$/i.exec(words[j + 1]?.text ?? "") : null;
    if (alias) nested.push(aliasBody("git", alias[1]));
    j++;
  }
  const sub = words[j]?.text;
  const rest = words.slice(j + 1).map((w) => w.text);
  if (sub === "config") {
    const k = rest.findIndex((w) => /^alias\./i.test(w));
    if (k !== -1 && rest[k + 1] !== undefined) nested.push(aliasBody("git", rest[k + 1]));
  }
  if (sub === "submodule" && rest.includes("foreach")) nested.push(rest.slice(rest.indexOf("foreach") + 1).filter((w) => !w.startsWith("--")).join(" "));
  if (sub === "rebase") for (let k = 0; k < rest.length; k++) nested.push(...[optionValue(rest, k, ["-x", "--exec"])[0]].filter((v): v is string => v !== undefined));
  if (sub === "bisect" && rest[0] === "run") nested.push(rest.slice(1).join(" "));
}

const runnable = (word: string) => {
  const name = commandName(word);
  return name === "git" || name === "gh" || INTERPRETERS.has(name) || EVALUATORS.has(name);
};

// `bash -c "…"`, `pwsh -Command "…"`, `cmd /c …`, `eval "…"`, `iex '…'` run their argument. A value
// assigned in the command that starts with a command (`M="gh pr merge 1"; $M`) may run as `$M`,
// and an alias definition runs its body later: both are read as the command they hold.
function nestedOf(words: Word[], nested: string[]): void {
  for (let i = 0; i < words.length; i++) {
    const name = commandName(words[i].text);
    if (EVALUATORS.has(name)) nested.push(words.slice(i + 1).map((w) => w.text).join(" "));
    if (INTERPRETERS.has(name)) {
      const flag = words.findIndex((w, k) => k > i && /^(?:-[a-z]*c|-command|\/c)$/i.test(w.text));
      if (flag !== -1) nested.push(words.slice(flag + 1).map((w) => w.text).join(" "));
    }
    if (words[i].raw && ASSIGNMENT.test(words[i].text)) {
      const value = words[i].text.slice(words[i].text.indexOf("=") + 1);
      if (runnable(value.trim().split(/\s+/)[0] ?? "")) nested.push(value);
    }
    if (name === "git") gitNested(words, i, nested);
    if (name === "gh" && words[i + 1]?.text === "alias" && words[i + 2]?.text === "set") {
      const opts = words.slice(i + 3).map((w) => w.text);
      const body = opts.filter((w) => !w.startsWith("-"))[1];
      if (body !== undefined) nested.push(opts.some((w) => /^(?:-s|--shell)$/.test(w)) ? body : aliasBody("gh", body));
    }
  }
}

// Pure. Which remote actions does this shell command perform?
export function remoteActions(command: string, depth = 0): RemoteAction[] {
  const found = new Set<RemoteAction>();
  const { statements, nested } = tokenize(command);
  for (const words of statements) {
    statementActions(words, found);
    nestedOf(words, nested);
  }
  for (const body of nested) {
    const inner = depth < 3 ? remoteActions(body, depth + 1) : [];
    for (const a of inner) found.add(a);
    // Too deep or unparsed but remote-looking: demand the strictest wording.
    if (!inner.length && REMOTE_HINT.test(body)) found.add("push-force");
  }
  return [...found];
}

// Plan 045, the factory grant (spec D6). Under a grant only two exact shapes publish, each as the
// whole command: `git push [-u] origin <grant branch>` and a draft PR from that branch to the grant
// repo. Any other push or PR form, any merge, ready or API write, and any git or gh run this
// reader cannot vouch for (an alias, a non-read gh command, a command word built at run time) is
// denied. This is a guard against honest mistakes and the shapes the tests name, not a boundary:
// shell, git and PowerShell can build a command line in more ways than a reader can follow (spec
// D7). The boundary is GitHub: a repo-scoped token and the base branch's required review.
export type FactoryItem =
  | { kind: "push"; canonical: boolean; force: boolean; remote?: string; refspecs: string[] }
  | { kind: "pr-create"; canonical: boolean; draft: boolean; head?: string; repo?: string }
  | { kind: "other"; what: string }
  | { kind: "pr-ready" | "pr-merge" | "api-write" | "unknown" };

// `--all`, `--branches`, `--tags`, `--follow-tags` push more than one ref: `*` matches no grant.
const PUSH_WIDE = /^--(?:all|branches|tags|follow-tags)$/;
const PUSH_VALUE_OPTIONS = new Set(["-o", "--push-option", "--receive-pack", "--exec", "--repo"]);
const FACTORY_HINT = /\bpush\b|\bgh(?:\.exe)?\b/i;
const REMOTE_WORD = /^(?:push|pr|api|merge)$/i;
// Git ignores an alias named like a builtin (git-config, ALIASES), so a builtin is never an alias.
// Builtins that publish (send-pack, http-push, send-email, svn, p4) are left out on purpose.
const GIT_BUILTINS = new Set(
  ("add am annotate apply archive bisect blame branch bundle cat-file check-attr check-ignore check-mailmap check-ref-format " +
    "checkout checkout-index cherry cherry-pick clean clone column commit commit-graph commit-tree config count-objects " +
    "describe diff diff-files diff-index diff-tree difftool fetch for-each-ref format-patch fsck gc grep hash-object help " +
    "init interpret-trailers log ls-files ls-remote ls-tree maintenance merge merge-base merge-file merge-tree mergetool " +
    "mktag mktree mv name-rev notes prune pull push range-diff read-tree rebase reflog remote repack replace rerere reset " +
    "restore rev-list rev-parse revert rm shortlog show show-branch show-ref sparse-checkout stash status stripspace " +
    "submodule switch symbolic-ref tag update-index update-ref var verify-commit verify-tag version whatchanged worktree write-tree").split(" "),
);
// gh commands that only read; `null` allows every subcommand. Anything else, an alias included,
// is outside a grant.
const GH_READ = new Map<string, readonly string[] | null>([
  ["pr", ["view", "list", "status", "checks", "diff"]],
  ["issue", ["view", "list", "status"]],
  ["repo", ["view"]],
  ["run", ["view", "list", "watch"]],
  ["workflow", ["view", "list"]],
  ["release", ["view", "list"]],
  ["auth", ["status"]],
  ["search", null],
  ["status", null],
]);
const PR_FLAGS = new Set(["--draft", "-d", "--fill", "--fill-first", "--fill-verbose"]);
const PR_VALUE_FLAGS = ["--title", "-t", "--body", "-b", "--body-file", "-F", "--base", "-B", "--head", "-H", "--repo", "-R", "--label", "-l", "--assignee", "-a", "--reviewer", "-r", "--milestone", "-m"];
const WRAPPERS = new Set(["xargs", "sudo", "doas", "env", "time", "timeout", "nohup", "nice", "command", "exec", "watch"]);
// Commands that never run their arguments: a quoted `"gh pr merge 1"` or a bare `gh` given to them
// is data. git runs text only through settings and aliases, which gitReading and gitNested read.
const DATA_COMMANDS = new Set(["rg", "grep", "egrep", "fgrep", "git", "echo", "printf", "jq", "cat", "wc", "which", "head", "tail", "ls"]);
// Quoted text that holds a gh or git push command line.
const QUOTED_REMOTE = /\bgh(?:\.exe)?\s+\w|\bgit(?:\.exe)?\b[\s\S]*\bpush\b/i;
const holdsRemote = (text: string) => /\s/.test(text) && QUOTED_REMOTE.test(text.replace(/\\/g, ""));

// A refspec's destination: `src:dst` lands on dst, a bare ref on its own name.
const destinationOf = (refspec: string) => refspec.slice(refspec.indexOf(":") + 1).replace(/^refs\/heads\//, "");

const isRunPrefix = (w: Word) => WRAPPERS.has(commandName(w.text)) || w.text.startsWith("-") || /^\d/.test(w.text) || (w.raw && ASSIGNMENT.test(w.text));

// The word the statement finally runs, past its `VAR=value` prefix and wrappers such as timeout.
function runIndex(words: Word[]): number {
  let i = commandIndex(words);
  while (i < words.length && isRunPrefix(words[i])) i++;
  return i;
}

const runName = (words: Word[]) => commandName(words[runIndex(words)]?.text ?? "");

// Does the statement run words[i], directly or through a wrapper such as xargs or timeout?
function runsAt(words: Word[], i: number): boolean {
  const c = commandIndex(words);
  return i >= c && words.slice(c, i).every(isRunPrefix);
}

// git or gh named by a command the reader does not know (`find -exec`, `stdbuf`) may run.
function hiddenRun(words: Word[], tool: string, items: FactoryItem[]): void {
  if (!DATA_COMMANDS.has(runName(words))) items.push({ kind: "other", what: `${tool} run by ${runName(words) || "a command"}, which the gate does not read` });
}

function pushItem(rest: string[], force: boolean, shaped: boolean): FactoryItem {
  const positional: string[] = [];
  let remote: string | undefined;
  let wide = false;
  for (let k = 0; k < rest.length; k++) {
    const w = rest[k];
    if (FORCE_WORD.test(w) || FORCE_CONFIG.test(w)) force = true;
    if (w === "-u" || w === "--set-upstream") continue;
    if (!w.startsWith("-")) {
      positional.push(w);
      continue;
    }
    shaped = false;
    if (PUSH_WIDE.test(w)) wide = true;
    const [repo, consumed] = optionValue(rest, k, ["--repo"]);
    if (repo !== undefined) remote = repo;
    if (PUSH_VALUE_OPTIONS.has(w)) k += consumed || 1;
  }
  remote ??= positional.shift();
  const refspecs = wide ? [...positional, "*"] : positional;
  return { kind: "push", canonical: shaped && !force && remote !== undefined && refspecs.length === 1, force, refspecs, ...(remote !== undefined && { remote }) };
}

function gitReading(words: Word[], i: number, items: FactoryItem[]): void {
  let force = false;
  let j = i + 1;
  for (; j < words.length && words[j].text.startsWith("-"); j++) {
    if (!GIT_VALUE_OPTIONS.has(words[j].text)) continue;
    const value = words[j + 1]?.text ?? "";
    if (words[j].text === "-c" && FORCE_CONFIG.test(value)) force = true;
    // `-c core.pager='gh pr merge 1'`: a setting git runs (aliases are read by gitNested).
    if (words[j].text === "-c" && !/^alias\./i.test(value) && holdsRemote(value)) items.push({ kind: "unknown" });
    j++;
  }
  const sub = words[j]?.text;
  // Global options (`-C`, `-c`, `--git-dir=`) move where a push lands, so a push with any is not canonical.
  if (sub === "push") return void items.push(pushItem(words.slice(j + 1).map((w) => w.text), force, i === 0 && j === i + 1));
  if (sub === "subtree" && words.slice(j + 1).some((w) => w.text === "push")) return void items.push({ kind: "unknown" });
  // `git config credential.helper '!gh pr merge 1'`: stored now, run by a later git call.
  const rest = words.slice(j + 1).map((w) => w.text);
  if (sub === "config" && !rest.some((w) => /^alias\./i.test(w)) && rest.some(holdsRemote)) items.push({ kind: "unknown" });
  if (!runsAt(words, i)) return hiddenRun(words, "git", items);
  if (sub === undefined ? words.slice(0, i).some((w) => commandName(w.text) === "xargs") : !GIT_BUILTINS.has(sub)) {
    items.push({ kind: "other", what: `git ${sub ?? "fed by xargs"}, which is not a git builtin` });
  }
}

function prItem(rest: string[], shaped: boolean): FactoryItem {
  let draft = false;
  let head: string | undefined;
  let repo: string | undefined;
  for (let k = shaped ? 2 : 0; k < rest.length; k++) {
    const w = rest[k];
    if (w === "--draft" || w === "-d") draft = true;
    if (PR_FLAGS.has(w)) continue;
    const [value, consumed] = optionValue(rest, k, PR_VALUE_FLAGS);
    if (value === undefined) {
      shaped = false;
      continue;
    }
    if (/^(?:-H|--head)/.test(w)) head = value;
    if (/^(?:-R|--repo)/.test(w)) repo = value;
    k += consumed;
  }
  return { kind: "pr-create", canonical: shaped, draft, ...(head !== undefined && { head }), ...(repo !== undefined && { repo }) };
}

function ghReading(words: Word[], i: number, items: FactoryItem[]): void {
  const rest = words.slice(i + 1).map((w) => w.text);
  const plain = rest.filter((w, k) => !w.startsWith("-") && !/^(?:-R|--repo)$/.test(rest[k - 1] ?? ""));
  if (plain[0] === "api") {
    if (apiWrites(rest)) items.push({ kind: "api-write" });
    return;
  }
  if (plain[0] === "pr" && plain[1] === "ready") return void items.push({ kind: "pr-ready" });
  if (plain[0] === "pr" && plain[1] === "merge") return void items.push({ kind: "pr-merge" });
  if (plain[0] === "pr" && (plain[1] === "create" || plain[1] === "new")) return void items.push(prItem(rest, i === 0 && rest[0] === "pr" && rest[1] === plain[1]));
  if (!runsAt(words, i)) return hiddenRun(words, "gh", items);
  const read = GH_READ.get(plain[0] ?? "");
  if (read === undefined || (read !== null && !read.includes(plain[1] ?? ""))) {
    items.push({ kind: "other", what: `gh ${plain.slice(0, 2).join(" ") || "with no subcommand"}, which is not a read-only gh command` });
  }
}

// Pure. Every remote item this command performs, nested shells included; remote-looking text it
// cannot parse is `unknown`, which no grant allows. Only a lone top-level statement can be canonical.
export function factoryReading(command: string, depth = 0): FactoryItem[] {
  const items: FactoryItem[] = [];
  const { statements, nested } = tokenize(command);
  let sawXargs = false;
  let sawShell = false;
  for (const words of statements) {
    // `$G pr merge 1`, `"$GIT" push …`: the command word is built at run time.
    const c = commandIndex(words);
    if (words[c]?.text.includes("$") && words.slice(c + 1).some((w) => REMOTE_WORD.test(w.text))) items.push({ kind: "unknown" });
    const run = runName(words);
    const shell = INTERPRETERS.has(run) || EVALUATORS.has(run);
    // `… | sh`, `… | iex`, `bash <<EOF`, `bash -s x`: a shell with no script or `-c` runs whatever
    // reaches its stdin; `pwsh -EncodedCommand` runs base64 the gate cannot read.
    const after = words.slice(runIndex(words) + 1).map((w) => w.text);
    const windows = /^(?:pwsh|powershell|cmd)$/.test(run);
    const unread =
      after.every((w) => /^(?:-|\d*[<>])/.test(w)) ||
      after.some((w) => w === "-" || (!windows && /^-[a-z]*s[a-z]*$/.test(w)) || (windows && /^-(?:e|ec|enc|encodedcommand)$/i.test(w)));
    // `… | parallel`: the command line itself is built from stdin (xargs: after the loop).
    if ((shell && unread) || run === "parallel") items.push({ kind: "other", what: "a shell or eval fed on its standard input" });
    sawXargs ||= words.some((w) => commandName(w.text) === "xargs");
    sawShell ||= words.some((w) => INTERPRETERS.has(commandName(w.text)) || EVALUATORS.has(commandName(w.text)));
    // `env -S 'git push …'`, `watch 'gh pr merge 1'`: quoted text a command other than a reader runs.
    // Shells, eval and gh are read by their own rules; the prefix assignments by nestedOf.
    if (!shell && run !== "gh" && !DATA_COMMANDS.has(run) && words.slice(c).some((w) => holdsRemote(w.text))) items.push({ kind: "unknown" });
    for (let i = 0; i < words.length; i++) {
      const name = commandName(words[i].text);
      if (name === "git") gitReading(words, i, items);
      else if (name === "gh") ghReading(words, i, items);
    }
    nestedOf(words, nested);
  }
  // `… | xargs -I{} sh -c "{}"`: xargs builds the shell's script from stdin, whatever the
  // placeholder (the tokenizer splits `{}` into its own statements, so this reads the whole command).
  if (sawXargs && sawShell) items.push({ kind: "other", what: "a shell whose script xargs builds from its standard input" });
  const lone = depth === 0 && statements.length === 1 && nested.length === 0;
  for (const body of nested) {
    const inner = depth < 3 ? factoryReading(body, depth + 1) : [];
    items.push(...inner);
    if (!inner.length && FACTORY_HINT.test(body)) items.push({ kind: "unknown" });
  }
  return lone ? items : items.map((item) => ("canonical" in item ? { ...item, canonical: false } : item));
}

// One git query in `dir`: its trimmed stdout, or null when it fails. Injected so tests need no repo.
export type Git = (dir: string, args: string[]) => string | null;

const realGit: Git = (dir, args) => {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] });
  return r.status === 0 ? r.stdout.trim() : null;
};

// Only `https://github.com/o/r(.git)`, optionally with credentials: an SSH host is whatever the
// session's ssh config says, and the session can edit that.
function namesRepo(url: string, repo: string): boolean {
  const m = /^https:\/\/(?:[^@/]+@)?github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i.exec(url);
  return !!m && m[1].toLowerCase() === repo.toLowerCase();
}

const PUSH_SHAPE = "a push in any other shape";
const PR_SHAPE = "a PR in any other shape";

// Where a push lands is read from git, never guessed. `get-url --push --all` applies
// `pushInsteadOf` and lists every push URL, because git pushes to all of them.
function pushRefusal(item: Extract<FactoryItem, { kind: "push" }>, grant: Grant, git: Git, cwd: string): string | null {
  if (item.force) return "a force push or delete";
  if (item.remote !== undefined && /[:/@]/.test(item.remote)) return `a push to the URL ${item.remote}`;
  const outside = item.refspecs.find((r) => r !== "HEAD" && destinationOf(r) !== grant.branch);
  if (outside !== undefined) return `a push to ${outside === "*" ? "every branch or tag" : destinationOf(outside)}`;
  if (item.remote !== undefined && item.remote !== "origin") return `a push to the remote ${item.remote}`;
  if (!item.canonical || item.refspecs[0] !== grant.branch) return PUSH_SHAPE;
  const urls = git(cwd, ["remote", "get-url", "--push", "--all", "origin"])?.split("\n").map((u) => u.trim()).filter(Boolean) ?? [];
  if (!urls.length) return "a push to an origin whose URL git cannot read";
  const stray = urls.find((u) => !namesRepo(u, grant.repo));
  if (stray !== undefined) return `a push to ${stray}`;
  // An explicit `<src>` lands where `remote.origin.push` maps it, and a `.git/remotes` or
  // `.git/branches` file can carry its own `Push:` lines. A path git cannot give is no such file.
  if (git(cwd, ["config", "--get-all", "remote.origin.push"])) return "a push through a remote.origin.push mapping";
  for (const legacy of ["remotes/origin", "branches/origin"]) {
    const path = git(cwd, ["rev-parse", "--git-path", legacy]);
    if (path && existsSync(resolve(cwd, path))) return "a push through a legacy remotes file";
  }
  return null;
}

function refusalOf(item: FactoryItem, grant: Grant, git: Git, cwd: string): string | null {
  switch (item.kind) {
    case "push":
      return pushRefusal(item, grant, git, cwd);
    case "pr-create":
      if (item.head !== undefined && item.head !== grant.branch) return `a PR from ${item.head}`;
      if (item.repo !== undefined && item.repo.toLowerCase() !== grant.repo.toLowerCase()) return `a PR on ${item.repo}`;
      return item.canonical && item.draft && item.head !== undefined && item.repo !== undefined ? null : PR_SHAPE;
    case "pr-ready":
      return "marking a PR ready for review";
    case "pr-merge":
      return "a merge";
    case "api-write":
      return "a gh api write";
    case "other":
      return item.what;
    case "unknown":
      return "a remote command the gate cannot read";
  }
}

const FINAL_STEP = new Set(["a merge", "marking a PR ready for review"]);

// A merge or ready is not a doubt to note: the session ends at the draft PR and never offers them.
// An in-scope action in the wrong shape gets the exact command, so the session can go on.
function factoryReason(grant: Grant, what: string): string {
  const head = `The factory grant for ${grant.ticket} covers commits, a push of ${grant.branch} to ${grant.repo} and a draft PR from it; ${what} is outside it. `;
  if (what === PUSH_SHAPE) return head + `Run the push as a command of its own, exactly: git push -u origin ${grant.branch}`;
  if (what === PR_SHAPE) return head + `Run it as a command of its own, exactly: gh pr create --draft --head ${grant.branch} -R ${grant.repo} --title "<title>" --body-file <file> (no other flags, pipes or $(…)).`;
  if (FINAL_STEP.has(what)) return head + "A factory session ends at the draft PR: the merge is the user's, outside the session. Do not retry it, ask for it, offer it or note it anywhere.";
  return head + "The merge is always the user's. Do not retry it in another form: note it in dudas.md, and stop if it blocks the ticket.";
}

// Pure given `git`. The first item outside the grant, as a short phrase, or null when all fit. A
// merge or ready speaks first: its reason ends the matter, whatever else the command does.
function factoryRefusal(items: FactoryItem[], grant: Grant, git: Git, cwd: string): string | null {
  const final = (item: FactoryItem) => item.kind === "pr-merge" || item.kind === "pr-ready";
  for (const item of [...items.filter(final), ...items.filter((item) => !final(item))]) {
    const what = refusalOf(item, grant, git, cwd);
    if (what) return what;
  }
  return null;
}

// The gate's verdict for these items under a grant: a denial reason, or null to let it run.
export function factoryVerdict(items: FactoryItem[], grant: Grant, git: Git, cwd: string): string | null {
  const what = factoryRefusal(items, grant, git, cwd);
  return what ? factoryReason(grant, what) : null;
}

// D5, best-effort (spec D6): setting the variable from a session would mint a grant for a child
// `claude`. Read from what the shell runs, like remoteActions: a commit message or a heredoc of data
// that names it is not an assignment, and reading it stays free. A program that sets it (python, a
// script file) or a file written in one call and copied in a later one is out of reach.
const GRANT_VAR = "PONEGLYPH_FACTORY";
const GRANT_PREFIX = "PONEGLYPH_";
// `setx` is Windows' persistent user env: every process started later inherits it.
const SHELL_ENV_WRITERS = new Set(["export", "unset", "declare", "typeset", "readonly", "local", "env", "sudo", "doas", "setx"]);
// Settings and shell start-up files: a child `claude` or shell loads what is written there.
const GRANT_FILE = /(?:^|[\\/\s>'"=])(?:settings[\w.-]*\.json|\.zshenv|\.zshrc|\.zprofile|\.zlogin|\.bashrc|\.bash_profile|\.bash_login|\.bash_aliases|\.profile|\.envrc|config\.fish|[\w.]*profile\.ps1)\b/i;
const unquoted = (text: string) => text.replace(/["'\\`]/g, "");
// What may splice more name onto a partial one: `PONEGLYPH_$V`, `PONEGLYPH_FACT"ORY"`,
// `PONEGLYPH_FACT\ORY`, and the end of a word, since the tokenizer cuts `PONEGLYPH_FACTOR{Y,}` at
// the brace.
const SPLICE = /^(?:[$`{[*?"'\\]|$)/;

// The escapes a shell (`$'\x5f'`), printf (`\137`) or a JSON loader (`_`) decodes, so the
// name they spell is read as written. Used by the mint check only.
const decodeEscapes = (text: string) =>
  text.replace(/\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|([0-7]{3}))/g, (_, x, u, o) => String.fromCharCode(parseInt(x ?? u ?? o, x || u ? 16 : 8)));

const GRANT_ROOT = GRANT_PREFIX.slice(0, -1);

// The grant's name, in any case (Windows env names ignore it), or a partial one the shell may
// complete at run time (`PONEGLYPH${U}FACTORY` too). Other PONEGLYPH_ variables stay free:
// sessions set them for evals and tests.
function namesGrant(text: string): boolean {
  const upper = text.toUpperCase();
  const rest = GRANT_VAR.slice(GRANT_PREFIX.length);
  for (let at = upper.indexOf(GRANT_ROOT); at !== -1; at = upper.indexOf(GRANT_ROOT, at + 1)) {
    const next = at + GRANT_ROOT.length;
    if (upper[next] !== "_") {
      if (/^[$`{\\]$/.test(upper[next] ?? "")) return true;
      continue;
    }
    const name = /^\w*/.exec(upper.slice(next + 1))![0];
    if (name === rest || (rest.startsWith(name) && SPLICE.test(upper[next + 1 + name.length] ?? ""))) return true;
  }
  return false;
}

// Where a command writes: a redirect target, and the files of `tee` or `sed -i`/`perl -i`. A read
// (`grep PONEGLYPH_ ~/.zshrc`) names the file without writing it.
function writeTargets(statements: Word[][]): string[] {
  const words = statements.flat().map((w) => w.text);
  const targets = words.flatMap((w, k) => {
    const at = w.lastIndexOf(">");
    return at === -1 ? [] : [at === w.length - 1 ? (words[k + 1] ?? "") : w.slice(at + 1)];
  });
  for (const s of statements) {
    const i = s.findIndex((w) => ["tee", "sed", "perl"].includes(commandName(w.text)));
    if (i === -1) continue;
    const rest = s.slice(i + 1).map((w) => w.text);
    if (commandName(s[i].text) === "tee" || rest.some((w) => /^(?:-i|--in-place)/.test(w))) targets.push(...rest);
  }
  return targets;
}

function statementMints(words: Word[]): boolean {
  const prefix = commandIndex(words);
  // The statement runs the writer: `echo export VAR=x` only prints.
  const name = commandName(words[prefix]?.text ?? "");
  // macOS `launchctl setenv` reaches every app launched later; `getenv` only reads.
  const writer = SHELL_ENV_WRITERS.has(name) || (name === "launchctl" && /^(?:setenv|unsetenv)$/.test(words[prefix + 1]?.text ?? ""));
  return words.some((w, k) => {
    const text = w.text;
    return (
      // `VAR=… cmd`: an assignment only counts in the statement's prefix, so `rg VAR= .` is a search.
      (k < prefix && text.toUpperCase().startsWith(`${GRANT_VAR}=`)) ||
      (writer && namesGrant(text)) ||
      // PowerShell's env: drive (Set-Item, Remove-Item and their aliases) names it as `env:VAR`.
      (/(?:^|[\s:])env:/i.test(text) && !text.startsWith("$") && namesGrant(text)) ||
      // PowerShell `$env:VAR='…'` or `$env:VAR = '…'`.
      (/^\$env:/i.test(text) && namesGrant(text) && (text.includes("=") || words[k + 1]?.text.startsWith("="))) ||
      // `[Environment]::SetEnvironmentVariable('VAR', …)`: the `(` splits it into two statements.
      (/SetEnvironmentVariable$/i.test(text) && k === words.length - 1)
    );
  });
}

function mints(command: string, depth = 0): boolean {
  const { statements, nested } = tokenize(command);
  // `printf 'export …' >> ~/.zshenv`, `… | tee .claude/settings.local.json`: a grant written to a
  // file a later session loads. Read from what the shell runs, so a heredoc of data stays free.
  const ran = statements.flat().map((w) => w.text);
  // A heredoc body is data, except when the command writes it into one of those files.
  if (writeTargets(statements).some((t) => GRANT_FILE.test(t)) && (ran.some(namesGrant) || namesGrant(command))) return true;
  for (let s = 0; s < statements.length; s++) {
    const words = statements[s];
    if (statementMints(words)) {
      const setter = /SetEnvironmentVariable$/i.test(words.at(-1)?.text ?? "");
      if (!setter || namesGrant(statements[s + 1]?.[0]?.text ?? "")) return true;
    }
    nestedOf(words, nested);
  }
  return nested.some((body) => (depth < 3 ? mints(body, depth + 1) : namesGrant(body)));
}
const MINT_REASON = "Setting, exporting or unsetting PONEGLYPH_FACTORY, or writing it into a settings or shell start-up file, is denied in every session: only the launcher sets it, the grant that lets a session publish. Do not retry it in another form; tell the user.";

function writeFactoryLog(cwd: unknown, line: string): void {
  try {
    const path = learnedLog(cwd, "factory-gate.log");
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, line + "\n", "utf8");
  } catch {
    // the log never decides a verdict
  }
}

export interface GateDeps {
  env: Record<string, string | undefined>;
  git: Git;
  now: number;
  log: (cwd: unknown, line: string) => void;
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

// The prompt whose promptId is `promptId` in the main thread, the assistant text right before it,
// and the AskUserQuestion answers given since. A turn started by a task notification or an agent
// keeps its answers (a human gave them) but its prompt is "": that text never counts as an order.
// Null when that prompt is not (yet) in the transcript.
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
    const e = events[i] as { promptId?: string; isSidechain?: boolean };
    if (e?.promptId !== promptId || e.isSidechain) continue;
    const typed = userPromptOf(events[i]);
    if (typed === null) continue;
    const prompt = isHumanOrigin(events[i]) ? typed : "";
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

// The question the reply answers: the last sentence that ends in «?», else the last sentence. An
// offer earlier in the message («Hago push cuando me lo pidas. ¿Sigo con el refactor?») is not
// what a short «sí» says yes to. The style's closing `ROBIN:` line carries the verdict and the
// user's next step, so when there is one it is the whole message for this purpose.
function lastQuestion(text: string): string {
  const closing = text.match(/^\s*ROBIN:(.*)$/gm)?.at(-1) ?? text;
  const sentences = closing.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  return sentences.findLast((x) => /\?["'»”)*_\]]*$/.test(x)) ?? sentences.at(-1) ?? "";
}

function assents(turn: Turn, action: Exclude<RemoteAction, "push-force">): boolean {
  const prompt = foldText(turn.prompt);
  if (!ASSENT.test(prompt) || DEFERS.test(prompt)) return false;
  for (const m of prompt.matchAll(NAMES[action])) if (negated(prompt, m.index)) return false;
  // The offer often sits in quotes («responde "abre la PR"»), so quotes stay here.
  const offer = foldText(lastQuestion(turn.previousAssistantText));
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
const FILE_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);

// D5 through the file tools: a grant written into a settings or start-up file.
function writesGrant(input: Record<string, unknown>): boolean {
  const path = typeof input.file_path === "string" ? input.file_path : "";
  const edits = Array.isArray(input.edits) ? input.edits.map((e) => (e as { new_string?: unknown })?.new_string) : [];
  const text = [input.content, input.new_string, ...edits].filter((t): t is string => typeof t === "string").join("\n");
  return GRANT_FILE.test(path) && namesGrant(decodeEscapes(text));
}

// The whole hook for one raw stdin payload: a denial reason, or null to let the call run.
// Throws on a malformed payload; the entrypoint turns any throw into a fail-closed verdict.
// With a valid factory grant in the env (plan 045), the grant alone decides: a chat ask never widens
// it. Without one, today's attended rules apply unchanged.
export async function gateVerdict(rawPayload: string, deps: Partial<GateDeps> = {}): Promise<string | null> {
  const { env = process.env, git = realGit, now = Date.now(), log = writeFactoryLog } = deps;
  const payload = JSON.parse(rawPayload) as { tool_name?: string; tool_input?: Record<string, unknown>; transcript_path?: unknown; prompt_id?: unknown; agent_id?: unknown; cwd?: unknown };
  if (FILE_TOOLS.has(payload.tool_name ?? "")) return writesGrant(payload.tool_input ?? {}) ? MINT_REASON : null;
  const typed = payload.tool_input?.command;
  if (!SHELL_TOOLS.has(payload.tool_name ?? "") || typeof typed !== "string") return null;
  // PowerShell's escape character: ``g`h pr m`erge`` runs `gh pr merge`.
  const command = payload.tool_name === "PowerShell" ? typed.replace(/`(?=[A-Za-z])/g, "") : typed;
  const spelled = decodeEscapes(command);
  if (unquoted(spelled).toUpperCase().includes(GRANT_ROOT) && mints(spelled)) return MINT_REASON;
  const grant = factoryGrant(env, now);
  const items = grant ? factoryReading(command) : [];
  if (payload.agent_id && (remoteActions(command).length || items.length)) return SUBAGENT_REASON;
  if (grant) {
    if (!items.length) return null;
    const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
    const what = factoryRefusal(items, grant, git, cwd);
    const kinds = [...new Set(items.map((i) => i.kind))].join(",");
    log(payload.cwd, `${new Date(now).toISOString()} ${what ? "deny" : "allow"} ${kinds} ${grant.ticket}${what ? ` ${what}` : ""}`);
    return what ? factoryReason(grant, what) : null;
  }
  const { transcript_path: path, prompt_id: promptId } = payload;
  return judge(command, async () => (typeof path === "string" && path && typeof promptId === "string" && promptId ? readTurnWithRetry(path, promptId) : null));
}
