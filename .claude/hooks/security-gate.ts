#!/usr/bin/env bun
// Stop hook: scans recently modified files for potential secret leaks.
// Synchronous + visible: when a secret is suspected it surfaces a `systemMessage`
// to the user (stdout JSON). It NEVER blocks the turn (always exits 0) — it warns,
// it does not gate. Registered WITHOUT `async` so the systemMessage is not discarded.

import {
  isAbsolute as isAbsolutePathNative,
  relative as relativePathNative,
  resolve as resolvePathNative,
  sep as pathSep,
} from "node:path";
import { readHookStdin } from "./lib/hook-stdin";

// The optional quote after the key is what makes JSON and quoted YAML match: `"password":
// "..."` puts a closing quote between the key and the separator, so without it every .json
// file walked past the gate although .json is a scanned extension (H54, quality review
// 2026-09-11).
export const SECRET_PATTERN =
  /(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)['"]?\s*[=:]\s*['"]?[A-Za-z0-9_\-\.]{16,}['"]?/gi;

export const SECRET_PATTERN_CI =
  /(?:password|passwd|secret|api_key|apikey|access_token|accesstoken|private_key|privatekey)['"]?\s*[=:]\s*.{8,}/i;

// Markdown is documentation/illustration by nature: how-tos, skill references,
// and PR reports routinely contain `SECRET_KEY=...` / `password: ...` as EXAMPLES.
// SECRET_PATTERN_CI matches that prose en masse, so a stateless Stop hook re-surfaces
// the same false positives every turn — training the user to ignore the gate, which
// is exactly when a REAL leak gets missed. Real secrets live in .env / code / config,
// not in .md. So .md is intentionally NOT scanned; detection in the rest stays intact.
const TEXT_EXTENSIONS = new Set([
  ".ts", ".js", ".json", ".env", ".yaml", ".yml",
]);

export function hasTextExtension(filePath: string): boolean {
  // A dotted environment file (.env.local, .env.production) holds the same class of secret
  // as .env, but its last dot yields ".local" / ".production" and misses the set (H54).
  const base = (filePath.split(/[\\/]/).pop() ?? "").toLowerCase();
  if (base === ".env" || base.startsWith(".env.")) return true;
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}

// The .claude/ tree is Claude Code orchestration config — hooks, skills, commands,
// rules, settings — i.e. meta-system plumbing, NOT the project's business code where
// a real secret leak matters. By nature it CONTAINS secret-shaped literals: this very
// detector's SECRET_PATTERN, its tests (`API_KEY = "..."`), security how-tos, auth
// skills. Scanning it produces self-matching false positives every turn. The gate
// watches YOUR code; .claude/ is the tool, not the codebase. (.md anywhere is already
// excluded by hasTextExtension.) Tradeoff: a literal secret in .claude/settings.json
// is not caught — acceptable, that's tool config (secrets belong in env/gitignore).
export function isOrchestrationPath(filePath: string): boolean {
  return /(?:^|\/)\.claude\//.test(filePath);
}

// An OpenAPI/Swagger document is an API CONTRACT: its `examples:` blocks exist to
// illustrate request/response shapes, so credential-shaped placeholders are the
// point, not a leak. Measured case (an OpenAPI contract repo, 2026-08-06): the canonical
// `token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` — a bare JWT *header*, no
// payload, no signature — sits at openapi.yaml:103 and re-fired on every turn that
// touched the contract. Same failure mode the .md exclusion above was written for:
// a gate that cries wolf every turn trains the user to ignore it.
// Scoped by CONTENT, not extension, on purpose: docker-compose.yaml, Helm values.yaml
// and CI workflows are exactly where a real secret lives, and none of them declare
// an `openapi:`/`swagger:` version — their detection is untouched.
// Tradeoff (same shape as .md / .claude/): a real credential pasted into an
// `example:` is not caught. Measured cost at write time: 0 — the only secret-shaped
// lines in the whole contract repo were three copies of that placeholder.
// Known limit: a conventional openapi.json (indented root key) is NOT recognised.
// Left narrow on purpose — widen it when a real case shows up, not before.
export function isApiSpecDocument(content: string): boolean {
  return /^["']?(?:openapi|swagger)["']?:\s*['"]?\d/m.test(content.slice(0, 2048));
}

// Keys aligned with SECRET_PATTERN + SECRET_PATTERN_CI. Longer tokens first so
// `access_token` wins over a trailing `token` substring when extracting RHS.
const SECRET_RHS_EXTRACT =
  /(?:access_token|accesstoken|private_key|privatekey|api_key|apikey|password|passwd|secret|API_KEY|PRIVATE_KEY|PASSWORD|TOKEN|SECRET)['"]?\s*[=:]\s*(.*)$/i;

const TYPE_KEYWORDS = new Set([
  "string",
  "number",
  "boolean",
  "null",
  "undefined",
  "unknown",
  "any",
  "object",
  "bigint",
  "symbol",
  "void",
  "never",
  "str",
  "int",
  "float",
  "bool",
  "true",
  "false",
  "none",
]);

/** RHS after a secret-shaped key, or null when the line has no key match. */
export function extractSecretRhs(line: string): string | null {
  const m = line.match(SECRET_RHS_EXTRACT);
  return m ? m[1] : null;
}

// Type/schema RHS is not a credential value. Measured FP class (a frontend repo's
// generated types.gen.ts, 2026-08 and earlier turns): `password: string;` / `old_password:
// string;` — OpenAPI-generated property types. SECRET_PATTERN_CI's `.{8,}` treats
// ` string;` as a value because it is ≥8 chars, so every turn that touches the
// generated client re-fires the Stop gate. Same cry-wolf failure mode as .md /
// OpenAPI yaml exclusions above.
// Hand-written interfaces, Zod (`z.string()`), and Django field defs share the
// shape — path-excluding `types.gen.ts` would miss them. Filter by RHS class.
// Tradeoff: `password = getSecret()` (call, no literal) is not flagged — the gate
// hunts leaked VALUES, not dataflow.
export function isCredentialTypeAnnotation(rhs: string): boolean {
  let s = rhs.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*$/, "").trim();
  s = s.replace(/[,;]\s*$/, "").trim();
  if (!s) return false;

  // Quoted / template literal → value territory (real or example secret).
  if (/['"`]/.test(s)) return false;

  // PascalCase single identifier (`AccessToken`, `PasswordInput`) is a type name,
  // not a leaked value — must win over the continuous-token check below.
  if (/^[A-Z][A-Za-z0-9]*$/.test(s) && /[a-z]/.test(s)) return true;

  // Continuous secret-like token (JWT, base64, bare password) — not a type name,
  // unless it is exactly a type keyword (`string`, `number`, …).
  if (/^[A-Za-z0-9_\-+/=.]{8,}$/.test(s) && !TYPE_KEYWORDS.has(s.toLowerCase())) {
    return false;
  }

  // Schema / ORM builders and call expressions without string literals.
  if (/^(?:z|yup|joi|t|models|serializers)\./i.test(s)) return true;
  if (/\(.*\)/.test(s)) return true;

  // TS/Flow/Python type expressions: keywords, unions, arrays, generics, named types.
  const body = s.replace(/^readonly\s+/, "");
  if (
    /^(?:[A-Za-z_$][\w$]*(?:\[\])?(?:<[^;]+>)?)(?:\s*\|\s*(?:[A-Za-z_$][\w$]*(?:\[\])?(?:<[^;]+>)?|null|undefined))*$/.test(
      body,
    )
  ) {
    return true;
  }

  return false;
}

// Per-line secret check. Resets the stateful /g regex BEFORE testing — the
// lastIndex gotcha would silently skip alternating lines otherwise.
// Type/schema annotations that only LOOK secret-shaped are filtered out (see
// isCredentialTypeAnnotation) so the gate stays loud on real leaks only.
export function lineHasSecret(line: string): boolean {
  SECRET_PATTERN.lastIndex = 0;
  if (!(SECRET_PATTERN.test(line) || SECRET_PATTERN_CI.test(line))) return false;
  const rhs = extractSecretRhs(line);
  if (rhs !== null && isCredentialTypeAnnotation(rhs)) return false;
  return true;
}

export async function getModifiedFiles(cwd = process.cwd()): Promise<string[]> {
  // Separate staged and unstaged queries also work before the first commit.
  // NUL delimiters preserve spaces, non-ASCII names, and Git's quoted paths.
  const outputs = await Promise.all([
    ["diff", "--cached", "--name-only", "-z"],
    ["diff", "--name-only", "-z"],
    ["ls-files", "--others", "--exclude-standard", "-z"],
  ].map(async args => {
    const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
    const [out] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
    if (await proc.exited !== 0) throw new Error("Cannot inspect modified files in the selected Git worktree.");
    return out.split("\0");
  }));
  return [...new Set(outputs.flat())]
    .filter(f => f.length > 0 && hasTextExtension(f) && !isOrchestrationPath(f));
}

// Returns a list of "path:line" hits (empty if none). Pure — no stderr side effects,
// so main() can aggregate hits into a single visible systemMessage.
export async function scanFile(filePath: string): Promise<string[]> {
  const hits: string[] = [];
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return hits;
    const content = await file.text();
    if (isApiSpecDocument(content)) return hits; // contract examples, not credentials
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lineHasSecret(lines[i])) {
        hits.push(`${filePath}:${i + 1}`);
      }
    }
  } catch {
    // best-effort — skip unreadable files
  }
  return hits;
}

// Builds the Stop response for a set of hits, or null when clean (028/US4).
// Two channels on purpose: systemMessage reaches the USER; hookSpecificOutput
// .additionalContext reaches the MODEL (CC ≥2.1.163) so it can verify/redact
// in-turn instead of the warning dying on screen (CG-05). Still non-blocking.
export function buildStopResponse(hits: string[]): {
  systemMessage: string;
  hookSpecificOutput: { hookEventName: "Stop"; additionalContext: string };
} | null {
  if (hits.length === 0) return null;
  const list = hits.map((h) => `  - ${h}`).join("\n");
  return {
    systemMessage:
      `[security-gate] Potential secret(s) in recently modified files:\n${list}\n` +
      `Review, then remove and rotate/revoke before committing.`,
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext:
        `[security-gate] Suspected secret(s) at:\n${list}\n` +
        `Before continuing: Read each locus, verify whether it is a real credential; ` +
        `if real, redact it and tell the user to rotate/revoke it. If a false positive, say so explicitly.`,
    },
  };
}

// --- Git discipline (029/US4; hard gate expanded CLAUDE.md §Git / PR) ---------
// Measured friction: 10 incidents of unasked git mutations (commits taken over,
// unwanted authorship, pushes). Always-loaded rule: CLAUDE.md §Git / PR —
// hard gate (no proactive commit/push/PR; THIS-turn ask only; if about to
// slip → AskUserQuestion/drillme-clarify). This is the best-effort mechanical
// backstop: at Stop, compare the turn's git mutations against the user
// prompt's intent. Warn, never block.

// Full mutating class (critic MAJOR 3, 029): the measured incidents were
// commit/push, but the spec says "fix the input CLASS" — any state-mutating
// git/gh op counts. Read-only ops (log/diff/status/branch --list) never match.
// Tolerates `git -C <path> <verb>` (audit 2026-08-07): without it, -C mutations
// were invisible to the gate AND unexcludable by the cross-repo filter below.
export const GIT_MUTATION_RE =
  /\bgit\s+(?:-C\s+\S+\s+)?(?:commit|push|merge|rebase|reset\s+--hard|branch\s+-D)\b|\bgh\s+pr\s+(?:create|merge)\b/;

// A grep-shaped check must scan COMMANDS, not data (run-don't-predict corollary,
// docs/model-uplift-playbook.md —
// this gate's own test fixtures tripped it in production, 2026-08-05): strip
// heredoc bodies and quoted spans before matching, so `cat << EOF ... "git
// commit" ... EOF` and `echo "git push"` never count as mutations. Tradeoff:
// a real mutation hidden inside quotes (`bash -c "git push"`) is missed —
// acceptable for a best-effort warn.
export function stripShellData(command: string): string {
  let out = command;
  // Heredoc: from <<WORD / <<'WORD' / <<-"WORD" up to the line holding WORD.
  out = out.replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?\n\s*\1(?:\n|$)/g, " ");
  // Escaped quotes are CONTENT, not span delimiters — drop them first, or a
  // double-quoted JSON payload (`printf "{\"cmd\":\"git commit\"}"`) breaks the
  // span regex's parity and its fragments survive as fake mutations (the gate's
  // own smoke test tripped this on 2026-08-07 — same class as the heredoc fix).
  out = out.replace(/\\['"]/g, " ");
  // Quoted spans (single and double) — data, not invocations.
  out = out.replace(/'[^']*'/g, " ").replace(/"[^"]*"/g, " ");
  return out;
}
// User intent covers his real phrasings (es/EN, typos included in class).
export const COMMIT_INTENT_RE =
  /\b(commit|comm?itea|push|sube|súbelo|subelo|mergea|merge|rebasea|rebase|versiona|guarda los cambios|crea la pr|abre la pr|borra la rama|resetea)\b/i;

// --- Cross-repo exclusion (audit 2026-08-07) ----------------------------------
// Measured: 3/3 git-discipline fires in a month were contextual false positives —
// mutations in DISPOSABLE repos (test fixtures in /tmp, benchmark repos in the
// scratchpad), never in the session's working repo. The fix targets the CLASS:
// a mutation only counts if it lands under the session cwd. Best-effort warn →
// unresolvable destinations fail OPEN (silence over noise, same reasoning as the
// .md / OpenAPI exclusions in the secrets channel above).

export type MutationLocation = "session" | "external" | "unknown";

// Shell command → individual statements (chaining/pipes/newlines). Runs on the
// stripShellData output, so quoted spans and heredocs are already gone.
export function splitStatements(command: string): string[] {
  return command
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Resolves $VAR / ${VAR} for variables ASSIGNED INLINE in the same command
// (`SCRATCH=/tmp/x; cd $SCRATCH/y`). External vars stay unresolved on purpose —
// they surface as "unknown" downstream. `X=$(cmd ...)` never registers (the
// space inside breaks the \S+ anchor), which is the desired behavior for
// dynamically generated scratch dirs (mktemp): unresolvable → skip.
export function resolveInlineVars(statements: string[]): string[] {
  const vars = new Map<string, string>();
  const substitute = (s: string) =>
    s.replace(/\$\{?(\w+)\}?/g, (m, name: string) => vars.get(name) ?? m);
  return statements.map((stmt) => {
    const cleaned = stmt.replace(/^export\s+/, "");
    const assign = cleaned.match(/^([A-Za-z_]\w*)=(\S+)$/);
    if (assign) {
      vars.set(assign[1], substitute(assign[2]));
      return stmt;
    }
    return substitute(stmt);
  });
}

function resolveTarget(base: string | "unknown", target: string): string | "unknown" {
  if (target.includes("$") || target.startsWith("~")) return "unknown";
  if (target.startsWith("/")) return resolvePathNative(target);
  if (base === "unknown") return "unknown";
  return resolvePathNative(base, target);
}

// "dir is base or lives under it" — separator-agnostic (Windows `\` vs POSIX
// `/`), case-insensitive where the OS is, and cross-drive aware (`path.relative`
// returns an absolute path when the drives differ). Audit 010: the old
// `dir.startsWith(base + "/")` never matched on Windows, so `cd src && git
// commit` resolved to "external" and the discipline warning stayed silent.
function isInsideBase(base: string, dir: string): boolean {
  const rel = relativePathNative(base, dir);
  if (rel === "") return true;
  if (isAbsolutePathNative(rel)) return false;
  return rel !== ".." && !rel.startsWith(".." + pathSep);
}

// Where does the FIRST git mutation in this command land, relative to the
// session cwd? Tracks `cd` statement by statement (starting AT the session cwd)
// and honors `git -C <path>`. Mutations before a `cd` count as session-local.
// Both sides are normalized with the same resolver before comparing.
// ponytail: Git Bash drive paths (`cd /d/PYTHON/x`) resolve to `D:\d\PYTHON\x`
// and read as "external" (fail-open silence); upgrade trigger = a real missed
// fire on Windows with such a cd.
export function resolveMutationLocation(command: string, sessionCwd: string): MutationLocation {
  const statements = resolveInlineVars(splitStatements(command));
  const base = resolvePathNative(sessionCwd);
  let cwd: string | "unknown" = base;
  for (const stmt of statements) {
    const cdMatch = stmt.match(/^cd\s+(\S+)/);
    if (cdMatch) {
      cwd = resolveTarget(cwd, cdMatch[1]);
      continue;
    }
    if (GIT_MUTATION_RE.test(stmt)) {
      const scoped = stmt.match(/\bgit\s+-C\s+(\S+)/);
      const dir = scoped ? resolveTarget(cwd, scoped[1]) : cwd;
      if (dir === "unknown") return "unknown";
      return isInsideBase(base, dir) ? "session" : "external";
    }
  }
  // Callers only invoke this on commands already confirmed as mutations.
  return "session";
}

// Stop can re-fire when a stop hook's additionalContext keeps the turn going;
// without this guard the gate is stateless and re-warns the same hits in a loop
// (030). stop_hook_active=true marks that continuation — skip everything.
export function shouldSkipStopHook(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { stop_hook_active?: unknown }).stop_hook_active === true
  );
}

// Bounded tail read (030): transcripts grow to many MB; loading the whole file
// on EVERY Stop is the heaviest I/O in the hook set. Byte-slice the end instead —
// a cut first line is fine, extractTurnFromTranscript skips malformed lines.
export async function readTranscriptTail(path: string, maxBytes = 256 * 1024): Promise<string> {
  const file = Bun.file(path);
  const size = file.size;
  if (size <= maxBytes) return file.text();
  return file.slice(size - maxBytes).text();
}

export interface TurnExtract {
  userPrompt: string;
  bashCommands: string[];
}

// Walks the transcript JSONL from the end: collects Bash tool_use commands seen
// AFTER the last plain-string user message (the turn's prompt). Malformed lines
// are skipped (best-effort by contract).
export function extractTurnFromTranscript(jsonl: string): TurnExtract {
  const lines = jsonl.split("\n");
  let userPrompt = "";
  const bashCommands: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    let event: unknown;
    try {
      event = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const e = event as { type?: string; message?: { content?: unknown } };
    if (e.type === "user" && typeof e.message?.content === "string") {
      userPrompt = e.message.content;
      break; // everything below this is a previous turn
    }
    if (e.type === "assistant" && Array.isArray(e.message?.content)) {
      for (const block of e.message.content as Array<{ type?: string; name?: string; input?: { command?: string } }>) {
        if (block.type === "tool_use" && block.name === "Bash" && typeof block.input?.command === "string") {
          bashCommands.push(block.input.command);
        }
      }
    }
  }
  return { userPrompt, bashCommands: bashCommands.reverse() };
}

// sessionCwd (optional, audit 2026-08-07): when provided, mutations resolving
// OUTSIDE it are excluded (disposable-repo false positives). Omitted → legacy
// behavior, kept as a pure-test escape hatch; main() always passes a real cwd.
export function buildGitDisciplineWarning(
  userPrompt: string,
  bashCommands: string[],
  sessionCwd?: string,
): { systemMessage: string; hookSpecificOutput: { hookEventName: "Stop"; additionalContext: string } } | null {
  const mutations = bashCommands.filter((c) => {
    const stripped = stripShellData(c);
    if (!GIT_MUTATION_RE.test(stripped)) return false;
    if (!sessionCwd) return true;
    return resolveMutationLocation(stripped, sessionCwd) === "session";
  });
  if (mutations.length === 0) return null;
  if (COMMIT_INTENT_RE.test(userPrompt)) return null; // the user asked — no friction
  const list = mutations.map((m) => `  - ${m.slice(0, 120)}`).join("\n");
  return {
    systemMessage:
      `[security-gate] Mutación git ejecutada sin petición aparente del usuario este turno:\n${list}\n` +
      `Regla (CLAUDE.md §Git / PR — hard gate): commit/push/PR proactivos PROHIBIDOS; solo con petición explícita ESTE turno. Si dudabas, debías AskUserQuestion/drillme-clarify, no mutar.`,
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext:
        `[security-gate] A git mutation ran this turn without apparent user request:\n${list}\n` +
        `Hard gate (CLAUDE.md §Git / PR): no proactive commit/push/PR. If it was NOT requested, tell the user now, ` +
        `offer to undo (e.g. soft reset), check no AI authorship was added, and next time STOP → AskUserQuestion/drillme-clarify.`,
    },
  };
}

async function main(): Promise<void> {
  try {
    const raw = await readHookStdin();
    if (!raw.trim()) process.exit(0);

    let payload: { transcript_path?: string; cwd?: string } = {};
    try {
      payload = JSON.parse(raw) as { transcript_path?: string; cwd?: string };
    } catch {
      // best-effort — unparseable payload → run with defaults
    }
    if (shouldSkipStopHook(payload)) process.exit(0); // re-entry guard (030)

    const files = await getModifiedFiles();
    const hits = files.length > 0 ? (await Promise.all(files.map(scanFile))).flat() : [];
    const secretResponse = buildStopResponse(hits);

    // Git discipline check (029/US4) — reads the turn from the transcript tail.
    let gitResponse: ReturnType<typeof buildGitDisciplineWarning> = null;
    try {
      if (payload.transcript_path) {
        const text = await readTranscriptTail(payload.transcript_path);
        const tail = text.split("\n").slice(-400).join("\n");
        // Cheap prefilters (031 + audit 2026-08-07): no Bash tool_use, or no
        // git/gh text at all, in the tail → no git mutation possible this turn;
        // skip the per-line JSONL parse entirely.
        if (tail.includes('"name":"Bash"') && (tail.includes("git") || tail.includes("gh pr"))) {
          const turn = extractTurnFromTranscript(tail);
          const sessionCwd = typeof payload.cwd === "string" ? payload.cwd : process.cwd();
          gitResponse = buildGitDisciplineWarning(turn.userPrompt, turn.bashCommands, sessionCwd);
        }
      }
    } catch {
      // best-effort — transcript unavailable/unreadable → skip this check
    }

    if (secretResponse || gitResponse) {
      const merged = {
        systemMessage: [secretResponse?.systemMessage, gitResponse?.systemMessage].filter(Boolean).join("\n\n"),
        hookSpecificOutput: {
          hookEventName: "Stop" as const,
          additionalContext: [
            secretResponse?.hookSpecificOutput.additionalContext,
            gitResponse?.hookSpecificOutput.additionalContext,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      };
      process.stdout.write(JSON.stringify(merged) + "\n");
    }
  } catch {
    // best-effort — never block
  }

  process.exit(0);
}

if (import.meta.main) {
  main();
}
