#!/usr/bin/env bun
// Stop hook: scans recently modified files for potential secret leaks.
// Synchronous + visible: when a secret is suspected it surfaces a `systemMessage`
// to the user (stdout JSON). It NEVER blocks the turn (always exits 0), it warns,
// it does not gate. Registered WITHOUT `async` so the systemMessage is not discarded.

import { stat } from "node:fs/promises";
import { appendLog } from "./instructions-loaded";
import { learnedLog } from "./lib/paths";
import { readHookStdin } from "./lib/hook-stdin";
import { readTranscriptTail } from "./lib/transcript";

// The optional quote after the key is what makes JSON and quoted YAML match: `"password":
// "..."` puts a closing quote between the key and the separator, so without it every .json
// file walked past the gate although .json is a scanned extension.
export const SECRET_PATTERN =
  /(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)['"]?\s*[=:]\s*['"]?[A-Za-z0-9_\-\.]{16,}['"]?/gi;

export const SECRET_PATTERN_CI =
  /(?:password|passwd|secret|api_key|apikey|access_token|accesstoken|private_key|privatekey)['"]?\s*[=:]\s*.{8,}/i;

// Markdown is documentation/illustration by nature: how-tos, skill references,
// and PR reports routinely contain `SECRET_KEY=...` / `password: ...` as EXAMPLES.
// SECRET_PATTERN_CI matches that prose en masse, so a stateless Stop hook re-surfaces
// the same false positives every turn, training the user to ignore the gate, which
// is exactly when a REAL leak gets missed. Real secrets live in .env / code / config,
// not in .md. So .md is intentionally NOT scanned; detection in the rest stays intact.
const TEXT_EXTENSIONS = new Set([
  ".ts", ".js", ".json", ".env", ".yaml", ".yml",
]);

export function hasTextExtension(filePath: string): boolean {
  // A dotted environment file (.env.local, .env.production) holds the same class of secret
  // as .env, but its last dot yields ".local" / ".production" and misses the set.
  const base = (filePath.split(/[\\/]/).pop() ?? "").toLowerCase();
  if (base === ".env" || base.startsWith(".env.")) return true;
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}

// The .claude/ tree is Claude Code orchestration config, hooks, skills, commands,
// rules, settings, i.e. meta-system plumbing, NOT the project's business code where
// a real secret leak matters. By nature it CONTAINS secret-shaped literals: this very
// detector's SECRET_PATTERN, its tests (`API_KEY = "..."`), security how-tos, auth
// skills. Scanning it produces self-matching false positives every turn. The gate
// watches YOUR code; .claude/ is the tool, not the codebase. (.md anywhere is already
// excluded by hasTextExtension.) Tradeoff: a literal secret in .claude/settings.json
// is not caught, acceptable, that's tool config (secrets belong in env/gitignore).
export function isOrchestrationPath(filePath: string): boolean {
  return /(?:^|\/)\.claude\//.test(filePath);
}

// An OpenAPI/Swagger document is an API CONTRACT: its `examples:` blocks exist to
// illustrate request/response shapes, so credential-shaped placeholders are the
// point, not a leak. Measured case (an OpenAPI contract repo, 2026-08-06): the canonical
// `token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`, a bare JWT *header*, no
// payload, no signature, sits at openapi.yaml:103 and re-fired on every turn that
// touched the contract. Same failure mode the .md exclusion above was written for:
// a gate that cries wolf every turn trains the user to ignore it.
// Scoped by CONTENT, not extension, on purpose: docker-compose.yaml, Helm values.yaml
// and CI workflows are exactly where a real secret lives, and none of them declare
// an `openapi:`/`swagger:` version, their detection is untouched.
// Tradeoff (same shape as .md / .claude/): a real credential pasted into an
// `example:` is not caught. Measured cost at write time: 0, the only secret-shaped
// lines in the whole contract repo were three copies of that placeholder.
// Known limit: a conventional openapi.json (indented root key) is NOT recognised.
// Left narrow on purpose, widen it when a real case shows up, not before.
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
function extractSecretRhs(line: string): string | null {
  const m = line.match(SECRET_RHS_EXTRACT);
  return m ? m[1] : null;
}

// Type/schema RHS is not a credential value. Measured FP class (a frontend repo's
// generated types.gen.ts, 2026-08 and earlier turns): `password: string;` / `old_password:
// string;`, OpenAPI-generated property types. SECRET_PATTERN_CI's `.{8,}` treats
// ` string;` as a value because it is ≥8 chars, so every turn that touches the
// generated client re-fires the Stop gate. Same cry-wolf failure mode as .md /
// OpenAPI yaml exclusions above.
// Hand-written interfaces, Zod (`z.string()`), and Django field defs share the
// shape, path-excluding `types.gen.ts` would miss them. Filter by RHS class.
// Tradeoff: `password = getSecret()` (call, no literal) is not flagged, the gate
// hunts leaked VALUES, not dataflow.
function isCredentialTypeAnnotation(rhs: string): boolean {
  let s = rhs.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*$/, "").trim();
  s = s.replace(/[,;]\s*$/, "").trim();
  if (!s) return false;

  // Quoted / template literal → value territory (real or example secret).
  if (/['"`]/.test(s)) return false;

  // PascalCase single identifier (`AccessToken`, `PasswordInput`) is a type name,
  // not a leaked value, must win over the continuous-token check below.
  if (/^[A-Z][A-Za-z0-9]*$/.test(s) && /[a-z]/.test(s)) return true;

  // Continuous secret-like token (JWT, base64, bare password), not a type name,
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

// Per-line secret check. Resets the stateful /g regex BEFORE testing, the
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

// In TS/JS a leaked credential can only be a string literal: an unquoted right-hand side
// is an identifier, a call or a member access, dataflow, not a value. Measured FP class
// (a local web app, 2026-10-05): 15 hits re-fired every turn, none real, `accessToken:
// t.access_token`, `clientSecret = await getSecret(...)`, test decoys ("gho_FAKE_…",
// "sk-ant-decoy-…"), short templates (`a${n}`) and key NAMES ("anthropic.api_key").
// .env / .json / .yaml keep the plain line rule: there an unquoted value IS the value.
// A word-joined literal is still reported ("synthetic-fixture-value" may be a password);
// only one that names a credential is a key name. A decoy says so ("fake-…").
// Tradeoff: a literal that calls itself a placeholder is not reported in code.
const CODE_FILE = /\.(?:ts|js)$/i;
const PLACEHOLDER = /fake|dummy|decoy|placeholder|example|redacted|changeme/i;
const KEY_NAME = /^(?=.*(?:key|token|secret|passw))[a-z]+(?:[._-][a-z]+)+$/;

export function codeLineHasSecret(line: string): boolean {
  if (!lineHasSecret(line)) return false;
  // The literal right after the key, up to its closing quote or the end of the line.
  const literal = (extractSecretRhs(line) ?? "").trimStart().match(/^(['"`])((?:\\.|(?!\1).)*)/);
  if (!literal) return false;
  const value = literal[2].replace(/\$\{[^}]*\}/g, "");
  return value.length >= 8 && !PLACEHOLDER.test(value) && !KEY_NAME.test(value);
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

// Only files written during this turn: a dirty file the user left alone re-warned on every
// Stop (11 of 12 warns over 14 days were one unchanged line). Files over 1 MB are generated or
// data. An unknown turn start (prompt outside the transcript tail) scans every dirty file.
const MAX_SCAN_BYTES = 1024 * 1024;

export async function filesChangedSince(files: string[], since: number | null): Promise<string[]> {
  const kept = await Promise.all(
    files.map(async (f) => {
      try {
        const s = await stat(f);
        return s.size <= MAX_SCAN_BYTES && (since === null || s.mtimeMs >= since) ? f : null;
      } catch {
        return null; // deleted or unreadable
      }
    }),
  );
  return kept.filter((f): f is string => f !== null);
}

// Returns a list of "path:line" hits (empty if none). Pure, no stderr side effects,
// so main() can aggregate hits into a single visible systemMessage.
export async function scanFile(filePath: string): Promise<string[]> {
  const hits: string[] = [];
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return hits;
    const content = await file.text();
    if (isApiSpecDocument(content)) return hits; // contract examples, not credentials
    const check = CODE_FILE.test(filePath) ? codeLineHasSecret : lineHasSecret;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (check(lines[i])) {
        hits.push(`${filePath}:${i + 1}`);
      }
    }
  } catch {
    // best-effort, skip unreadable files
  }
  return hits;
}

// Builds the Stop response for a set of hits, or null when clean.
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

// Stop can re-fire when a stop hook's additionalContext keeps the turn going;
// without this guard the gate is stateless and re-warns the same hits in a loop
//. stop_hook_active=true marks that continuation, skip everything.
export function shouldSkipStopHook(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { stop_hook_active?: unknown }).stop_hook_active === true
  );
}

// The text the human typed, or null when a "user" event is not a prompt: tool results
// come back as user events too, and meta or compaction-summary events are harness text.
// A prompt with an image or a pasted block is an array of text/image blocks, not a string.
export function userPromptOf(event: unknown): string | null {
  const e = event as { type?: string; isMeta?: boolean; isCompactSummary?: boolean; message?: { content?: unknown } };
  if (e?.type !== "user" || e.isMeta || e.isCompactSummary) return null;
  const content = e.message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const blocks = content as Array<{ type?: string; text?: unknown }>;
  if (blocks.some((b) => b?.type === "tool_result")) return null;
  const texts = blocks.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text as string);
  return texts.length ? texts.join("\n") : null;
}

// What the Stop hook needs from the turn: when its prompt arrived, and whether the turn ends
// waiting. A task-notification turn reports one background result while others may run, and a
// turn that launched background work (agents run async here) cannot have its result yet.
export interface TurnFacts {
  startedAt: number | null; // ms; null when the prompt is outside the tail
  waiting: boolean;
}

const BACKGROUND_TOOLS = new Set(["Agent", "Task", "Workflow", "Monitor", "ScheduleWakeup"]);

export function readTurnFacts(jsonl: string): TurnFacts {
  const lines = jsonl.split("\n");
  let waiting = false;
  for (let i = lines.length - 1; i >= 0; i--) {
    let event: unknown;
    try {
      event = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const e = event as { type?: string; isSidechain?: boolean; timestamp?: string; message?: { content?: unknown } };
    if (e.isSidechain) continue;
    const prompt = userPromptOf(event);
    if (prompt !== null) {
      const at = Date.parse(e.timestamp ?? "");
      return { startedAt: Number.isNaN(at) ? null : at, waiting: waiting || /^\s*<task-notification>/.test(prompt) };
    }
    if (e.type === "assistant" && Array.isArray(e.message?.content)) {
      for (const block of e.message.content as Array<{ type?: string; name?: string; input?: { run_in_background?: unknown } }>) {
        if (block.type === "tool_use" && (BACKGROUND_TOOLS.has(block.name ?? "") || block.input?.run_in_background === true)) waiting = true;
      }
    }
  }
  return { startedAt: null, waiting };
}

// Degradation canary: the house style asks every final answer to END with a line starting
// `ROBIN:` (verdict + the user's next step). A missing line is the cheap, mechanical sign that
// always-on instructions are dropping out of attention. A present one proves nothing about
// subtler rules.
const CANARY = "ROBIN:";

// Last assistant text block AFTER the turn's plain-string user prompt; null if the turn
// produced no text (tool-only or interrupted).
export function extractFinalAssistantText(jsonl: string): string | null {
  const lines = jsonl.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    let event: unknown;
    try {
      event = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const e = event as { type?: string; message?: { content?: unknown } };
    if (e.type === "user" && typeof e.message?.content === "string") return null;
    if (e.type === "assistant" && Array.isArray(e.message?.content)) {
      const texts = (e.message.content as Array<{ type?: string; text?: string }>).filter(
        (b) => b.type === "text" && typeof b.text === "string" && b.text.trim(),
      );
      if (texts.length > 0) return texts[texts.length - 1].text as string;
    }
  }
  return null;
}

// "wait": the line is missing on a turn that ends waiting for background work. Logged, never
// warned: an interim note is not a final answer. "No response requested." is harness filler.
export function checkCanary(text: string | null, waiting = false): "ok" | "miss" | "wait" | null {
  if (text === null || !text.trim() || text.trim() === "No response requested.") return null;
  const lastLine = text.trimEnd().split("\n").pop() as string;
  if (lastLine.trimStart().startsWith(CANARY)) return "ok";
  return waiting ? "wait" : "miss";
}

// User channel only: an additionalContext would re-open the turn just to fix a prefix.
export function buildCanaryWarning(transcriptKb: number): { systemMessage: string } {
  return {
    systemMessage: `[canario] La respuesta no terminó con una línea ${CANARY}, posible degradación (transcript ${transcriptKb} KB).`,
  };
}

async function main(): Promise<void> {
  try {
    const raw = await readHookStdin();
    if (!raw.trim()) process.exit(0);

    type StopPayload = { transcript_path?: string; cwd?: string; session_id?: string; last_assistant_message?: unknown };
    let payload: StopPayload = {};
    try {
      payload = JSON.parse(raw) as StopPayload;
    } catch {
      // best-effort, unparseable payload → run with defaults
    }
    if (shouldSkipStopHook(payload)) process.exit(0); // re-entry guard

    let text = "";
    try {
      if (payload.transcript_path) text = await readTranscriptTail(payload.transcript_path);
    } catch {
      // best-effort, transcript unavailable/unreadable → full secret scan, no canary
    }
    const facts = readTurnFacts(text);

    const files = await filesChangedSince(await getModifiedFiles(), facts.startedAt);
    const hits = files.length > 0 ? (await Promise.all(files.map(scanFile))).flat() : [];
    const secretResponse = buildStopResponse(hits);

    let canaryResponse: ReturnType<typeof buildCanaryWarning> | null = null;
    try {
      if (payload.transcript_path) {
        // Prefer the payload's final message: the transcript may not be flushed yet.
        const finalText =
          typeof payload.last_assistant_message === "string" ? payload.last_assistant_message : extractFinalAssistantText(text);
        const verdict = checkCanary(finalText, facts.waiting);
        if (verdict) {
          const kb = Math.round(Bun.file(payload.transcript_path).size / 1024);
          appendLog(`${new Date().toISOString()} ${payload.session_id ?? "unknown"} ${verdict} ${kb}`, learnedLog(payload.cwd, "canary.log"));
          if (verdict === "miss") canaryResponse = buildCanaryWarning(kb);
        }
      }
    } catch {
      // best-effort, the canary never blocks the secret check
    }

    if (secretResponse) {
      const systemMessage = [secretResponse.systemMessage, canaryResponse?.systemMessage].filter(Boolean).join("\n\n");
      process.stdout.write(JSON.stringify({ ...secretResponse, systemMessage }) + "\n");
    } else if (canaryResponse) {
      process.stdout.write(JSON.stringify(canaryResponse) + "\n");
    }
  } catch {
    // best-effort, never block
  }

  process.exit(0);
}

if (import.meta.main) {
  main();
}
