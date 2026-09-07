# Config Correctness Audit — `/code-review xhigh`

**Date**: 2026-06-03
**Scope**: poneglyph `.claude/` configuration (hooks, agents, skills, rules, `settings*.json`, `CLAUDE.md`) — NOT a code diff (git clean). Redirected per user: "que sea correcta, que esté bien pensada".
**Rubric**: `meta-create` + `meta-settings-cookbook` skills + 10 Commandments (esp. II truth, IV gates, VI security, X maintainability).
**Method**: inventory verify (Explore) → inline depth-read of 4 hooks + `settings*.json` → 4 breadth finders (scout/Explore) → sweep finder → 1-vote verify on contested findings (direct re-read).

## Verdict

**APPROVED_WITH_WARNINGS** — base structure is sound (inventory 100% matches declared claims; no dangling references in live config; clean frontmatter). The **secret-detection layer is largely non-functional** (3 MAJOR). Context matters: this repo self-declares non-enterprise-security, single-user, no untrusted-input flow — so these are **defense-in-depth hygiene defects, not live vulnerabilities** here. Plus config asymmetries + doc contradictions. None block usage; all are real defects worth fixing.

### Coverage caveats (honesty about this audit's depth)
- `builder.md` and `scout.md` were **only frontmatter-scanned** (Explore inventory pass), not deep-read. `builder` is the most-invoked agent; its prompt body is **unaudited**. "Config is correct" excludes those two bodies.
- Finding **#9** rests on the F2 finder's citation of `explain-changes.md:14`, **not a first-hand read** — concrete cite, MINOR severity, but less verified than the eye-confirmed findings.

| Severity | Count |
|---|---|
| MAJOR | 3 |
| MINOR | 7 |
| NIT | 4 |
| Refuted/discarded | 7 |

---

## Remediation (2026-06-03) — all 14 addressed

Verified: `bun test --cwd .claude/hooks` → **100 pass / 0 fail**; `settings.json` + `settings.local.json` valid JSON.

| # | Sev | Resolution | Files |
|---|---|---|---|
| 1 | MAJOR | **Decision: synchronous + systemMessage.** `security-gate.ts` refactored: `scanFile` returns hits (no stderr), `main` aggregates and emits `{"systemMessage"}` to stdout, early-out when no files changed; `async: true` → `timeout: 10`. Visible, non-blocking, no loop risk. | `security-gate.ts`, `settings.json` |
| 2 | MAJOR | `"BLOCKED"` → honest `"DETECTED — file already written, remove + rotate"` | `code-validator.ts` |
| 3 | MAJOR | substring `.includes()` → boundary regex `IGNORE_SEGMENT_PATTERN` | `code-validator.ts` |
| 4 | MINOR | added `Read(*.pem\|*credentials*\|*secret*)`, `Write(.env.*\|*credentials*\|*secret*\|./secrets/**)` | `settings.json` |
| 5 | MINOR | `timeout: 5000/3000` → `10` (seconds) | `settings.json` |
| 6 | MINOR | reviewer NEVER line reworded (no longer negates its quality mandate) | `reviewer.md` |
| 7 | MINOR | header "Prohibited" → "Delegated by default … unless exception" | `CLAUDE.md` |
| 8 | MINOR | "Identical-error override" note reconciles Retry Budget vs Stuck Detection | `error-recovery.md` |
| 9 | MINOR | **Decision: logic in skill, command = thin forward.** `explain-changes.md` reduced to a forward; `decide.md` already correct → untouched. | `commands/explain-changes.md` |
| 10 | MINOR | CC version claims marked "verify vs release notes" | `CLAUDE.md` |
| 11 | NIT | **Decision: keep `"*"`.** Single-user + auto; deny still wins. Project allow-list is documentary — recorded here, no code change. | (decision only) |
| 12 | NIT | `CLAUDE_LEAD_MODE: "true"` added to env → `getSessionMode` branch now live | `settings.json` |
| 13 | NIT | **Decision: document.** Comment in `auto-approve.ts` naming `autoMode.hard_deny` as primary guard | `auto-approve.ts` |
| 14 | NIT | `prompt-engineer` description gains `Use proactively when:` line | `prompt-engineer/SKILL.md` |

> Local to `E:\PYTHON\claude-code-poneglyph`. Run `/sync-claude` to propagate hook/agent/settings changes to `~/.claude/` (global). `builder.md` / `scout.md` bodies remain unaudited (coverage caveat above).

---

## Findings (ranked, most severe first)

### MAJOR

**1 — `security-gate.ts`: secret detector with invisible output**
`security-gate.ts:46-47` writes warnings to **stderr** only, then `:70` always `process.exit(0)`; registered with `"async": true` (`settings.json:75`). A Stop hook that exits 0 is silent by design (UI only surfaces hook output on error/slowness), and `async` discards output entirely. Its one differential value — catching secrets introduced via `Bash` (which `code-validator` misses, it only matches `Write|Edit`) — never reaches the user. `error-recovery.md` §Hook Reliability calls it "Stop | Reliable | Quality gate" → overstatement (Commandment II/VI).
**Fix (with honest trade-offs — not a free one-liner)**:
- **Safe path**: synchronous `{"systemMessage": "..."}` to stdout + `exit 0` (drop `async`). No loop risk, but adds 2 `git spawn`s + a file scan to **every turn end** — that per-turn latency (Commandment VII) is almost certainly *why* it was made `async`. Accept it, or gate the scan to only run when files changed.
- **`asyncRewake: true` + `exit 2`** path: ⚠️ this makes `security-gate` a Stop hook that exits 2 → triggers `meta-create` **gotcha #4** (Stop/SubagentStop + `exit 2` without a `stop_hook_active` guard = infinite loop: unresolved secret → rewake → exit 2 → rewake). Only viable WITH the guard. Do not adopt naked.

**2 — `code-validator.ts`: "BLOCKED" is semantically false in PostToolUse**
`code-validator` runs on **PostToolUse** → the file is already written when it fires. `reportError` (`config.ts:109-111`) does `exit 2`, whose own doc (`config.ts:37`) honestly says "Claude sees stderr and can auto-fix" — it does **not** revert the write. But `formatSecretsBlock` (`code-validator.ts:152-156`) prints `"BLOCKED (all secrets are high severity)"`, asserting a prevention that did not happen (Commandment II). Combined with #1, **no layer actually prevents a secret from landing on disk / git**.
**Fix**: reword to `"DETECTED — file already written; remove the secret AND rotate it"`, or move detection to PreToolUse (with the known unreliability caveat in `paths/hooks.md`).

**3 — `code-validator.ts`: `shouldIgnorePath` uses substring `.includes()`**
`code-validator.ts:27-40` skips any path containing `"test"|"spec"|"mock"|"fixture"`. Substring match → silent security false-negatives: `latest.ts` (con**t, la-test**), `inspector.ts` ("in-**spec**-tor"), `mockup.ts` ("**mock**up") bypass the secret/injection scan entirely.
**Fix**: match path segments with boundaries, e.g. `/(^|[\\/_.-])(test|spec|mock|fixture)([._-]|s?[\\/]|$)/`.

### MINOR

**4 — deny-list asymmetry (Read vs Edit) + dotenv variants uncovered**
`settings.json:43-52`: (a) `*.pem` / `*credentials*` / `*secret*` are blocked on `Edit`/`Write` but **readable** (`Read` only covers `.env*`, `secrets/**`) → a `.pem` private key can be read into context. (b) `Write(.env)` is exact-match while `Read(./.env.*)` uses a wildcard → `Write(.env.production)` / `.env.local` slip through.
**Fix**: add `Read(*.pem)`, `Read(*credentials*)`, `Read(*secret*)`, `Write(.env.*)`, `Write(secrets/**)`.

**5 — hook `timeout` set in ms but schema expects seconds**
`settings.json:86` `post-compact timeout: 5000` = 83 min; `:97` `auto-approve timeout: 3000` = 50 min. CC hook-command `timeout` is **seconds** (the schema; contrast `BASH_DEFAULT_TIMEOUT_MS` which names ms). Intent almost certainly 5s / 3s. If a hook hangs (slow `bun` start, stuck `git spawn`), the permission prompt / compaction stalls up to 50/83 min. *(value CONFIRMED wrong; impact PLAUSIBLE)*
**Fix**: `5` and `3`.

**6 — `reviewer.md:40` contradicts the agent's own role**
`The reviewer NEVER: ... Decides design quality and adherence to plan` (`:40`) negates what Primary Responsibilities (`:44` "quality and correctness") and the SOLID/complexity checklists (`:594-601`) demand. A reviewer reading its NEVER literally would skip quality assessment — its core job (Commandment VIII: a contradictory prompt degrades the agent).
**Fix**: rephrase → "NEVER decides whether the technical plan itself is correct (Lead / `tech-plan`'s call)".

**7 — `CLAUDE.md` header "Prohibited for the Lead: Read, Edit, Write, Bash, Glob, Grep…" is facially false**
The very next lines grant "Read any path — always allowed" and "Write/Edit/Bash — the Lead may act directly when…". The header negates what its immediate exceptions concede; a literal reader gets the wrong model.
**Fix**: rephrase header → "Delegated by default (act inline only per the exceptions below)".

**8 — `error-recovery.md`: Retry Budget vs Stuck Detection inconsistent**
`:11` Retry Budget allows "Builder test failure | 2" retries; `:66-68` Stuck Detection says "Same exact error 2 times → STOP". If the retries reproduce the same error, the two tables disagree on when to stop.
**Fix**: reconcile — e.g. "2 retries, unless the error is identical, then stop on the 2nd".

**9 — commands `decide` / `explain-changes` duplicate their namesake skills' logic**
`CLAUDE.md` §System inventory declares the canonical pattern "skill-name = command-name WITHOUT a redundant wrapper". `commands/explain-changes.md:14` re-implements arg-resolution that already lives in the skill → silent divergence risk.
**Fix**: command just forwards `$ARGUMENTS`; logic stays in the skill.

**10 — `CLAUDE.md` asserts specific CC versions without a source (Commandment II self-application)**
`:186` "CC ≥2.1.133 fixed prior breakage", `:199` "agent-view CC ≥2.1.139", `:196` "Workflow GA 2.1.154" — version claims not internally verifiable, fragile to drift.
**Fix**: add `[verify against release notes]` disclaimer / link, or relax to "recent CC versions".

### NIT

**11 — `settings.local.json` `allow: ["*"]` makes project allow-list dead**
`settings.local.json:3-5` `"*"` covers the 19 curated `allow` entries of `settings.json:14-34` (now redundant). Not a security risk (deny still wins, denies merge across sources), but confusing maintenance.
**Fix**: drop `"*"` from local, or note the project allow-list is documentary.

**12 — `post-compact.ts` dead `getSessionMode` branch**
`:19-25` reads `CLAUDE_LEAD_MODE` env, which is not set in `settings.json` → always returns null.
**Fix**: remove `getSessionMode`, or set the env var.

**13 — `auto-approve.ts` block-list overlaps `autoMode.hard_deny`; reach in auto mode dubious**
With `defaultMode: "auto"`, the real destructive guards live in `autoMode.hard_deny` (`settings.json:154-161`); `auto-approve.ts:30-44` duplicates part (rm, git push) and its `PermissionRequest` reach in auto mode is uncertain *(PLAUSIBLE, not confirmed without CC docs; the responsibility overlap IS real)*.
**Fix**: consolidate the destructive policy in one place (autoMode), or document why both exist.

**14 — `prompt-engineer` uses `when_to_use:` instead of inline "Use when:" in `description`**
`prompt-engineer/SKILL.md:6`. Works (it renders in the skill listing) but inconsistent with the other 19 skills.
**Fix**: align style, or document the convention.

---

## Discarded (REFUTED — recorded for honesty)

| Claim | Why refuted |
|---|---|
| `reviewer.md model: opus` degrades to Sonnet | `opus` is a valid CC family alias (settings schema: "Accepts family aliases") |
| `security-gate` regex `lastIndex` alternating-line bug | A no-match on a `/g` regex resets `lastIndex` to 0; behavior correct |
| `CLAUDE.md` "6 hooks" vs "4" contradiction | Distinct temporal columns (audit→cleanup→refactor); documented evolution, not contradiction |
| `/drillme` has no command file | Skills are invokable as `/skill-name` natively; not broken |
| `_research-*.md` aspirational ACs | Archived research artifact, not live config — out of scope |
| `#!/usr/bin/env bun` shebang | `bun` is on PATH (`settings.json:7`) and invoked explicitly; correct |
| output-style, hook tests | Clean: valid frontmatter, imports resolve, no setup/teardown asymmetry |

---

## Findings JSON (per `/code-review` schema)

```json
[
  {"file": ".claude/hooks/security-gate.ts", "line": 70, "summary": "Secret detector's only output is stderr+exit0+async:true, making warnings invisible to the user", "failure_scenario": "Bash writes API_KEY=... to a file; security-gate scans it on Stop, detects it, writes to stderr, exits 0 async → warning never surfaces; error-recovery.md still bills it as a 'reliable quality gate'"},
  {"file": ".claude/hooks/validators/code-validator.ts", "line": 156, "summary": "'BLOCKED' message is false in PostToolUse — the secret is already on disk", "failure_scenario": "Builder writes ghp_... token; PostToolUse fires post-write, prints 'BLOCKED' and exits 2; Claude may auto-fix next turn but the secret already existed on disk/git for that interval"},
  {"file": ".claude/hooks/validators/code-validator.ts", "line": 37, "summary": "shouldIgnorePath uses substring .includes(), silently skipping security scan on innocent names", "failure_scenario": "A file named latest.ts ('la-test'), inspector.ts ('in-spec-tor') or mockup.ts ('mock-up') containing a hardcoded secret bypasses detectSecrets/detectInjections entirely"},
  {"file": ".claude/settings.json", "line": 43, "summary": "deny-list blocks Edit/Write of *.pem/*credentials*/*secret* but allows Read; Write(.env) misses dotenv variants", "failure_scenario": "Read(server.pem) loads a private key into context unblocked; Write(.env.production) with creds slips past the exact-match Write(.env) rule"},
  {"file": ".claude/settings.json", "line": 86, "summary": "Hook timeout set in ms (5000/3000) but CC schema expects seconds → 83min/50min", "failure_scenario": "post-compact.ts or auto-approve.ts hangs on a slow bun start → permission prompt / compaction stalls up to 50-83 minutes instead of the intended ~5/3s"},
  {"file": ".claude/agents/reviewer.md", "line": 40, "summary": "'NEVER: Decides design quality' contradicts the reviewer's own Primary Responsibilities + SOLID checklist", "failure_scenario": "reviewer reads its NEVER literally and omits quality/SOLID assessment, which is its core mandate"},
  {"file": "CLAUDE.md", "line": 0, "summary": "Header 'Prohibited for the Lead: Read, Edit, Write, Bash, Glob, Grep' is contradicted by its own immediate exceptions", "failure_scenario": "A reader/agent acting on the header alone refuses to Read for orientation, despite 'Read any path — always allowed' on the next line"},
  {"file": ".claude/rules/error-recovery.md", "line": 11, "summary": "Retry Budget (2 retries) vs Stuck Detection (stop after 2 identical errors) disagree on stop threshold", "failure_scenario": "Builder fails with the same error twice; Retry Budget would allow a 2nd retry while Stuck Detection says STOP — ambiguous which fires"},
  {"file": ".claude/commands/explain-changes.md", "line": 14, "summary": "Command re-implements arg-resolution logic that already lives in the skill, against the declared no-redundant-wrapper pattern", "failure_scenario": "Command updated but skill not (or vice versa) → /explain-changes and the skill diverge silently"},
  {"file": "CLAUDE.md", "line": 186, "summary": "Asserts specific CC versions (2.1.133/139/154) as fact without a source — fragile to drift", "failure_scenario": "CC evolves past these versions; the version-pinned behavior claims become misleading with no way to verify them in-repo (Commandment II)"},
  {"file": ".claude/settings.local.json", "line": 3, "summary": "allow:['*'] makes the 19-entry curated allow-list in project settings.json dead code", "failure_scenario": "Maintainer edits the project allow-list expecting an effect; '*' in local already grants everything (deny still wins), so the edit is inert"},
  {"file": ".claude/hooks/post-compact.ts", "line": 19, "summary": "getSessionMode reads CLAUDE_LEAD_MODE env that is never set → dead branch", "failure_scenario": "The Session Mode section never injects after compaction because CLAUDE_LEAD_MODE is absent from settings.json env"},
  {"file": ".claude/hooks/auto-approve.ts", "line": 30, "summary": "Block-list overlaps autoMode.hard_deny and its PermissionRequest reach in auto mode is uncertain", "failure_scenario": "Destructive-op policy is split across auto-approve.ts and autoMode.hard_deny; editing one leaves the other stale"},
  {"file": ".claude/skills/prompt-engineer/SKILL.md", "line": 6, "summary": "Uses when_to_use: frontmatter instead of inline 'Use when:' in description, inconsistent with the other 19 skills", "failure_scenario": "Style drift only — renders fine in the listing; cost is inconsistency for future skill authors"}
]
```
