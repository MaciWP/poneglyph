---
name: consult
description: |
  Consulta a un modelo EXTERNO (OpenAI Codex o xAI Grok) o a una instancia Claude de contexto fresco (`--restricted`) como segundo cerebro: preguntas puntuales, segundas opiniones/refutación de planes o diffs, sweeps paralelos read-only, o contraste doble (dos modelos sobre la misma pregunta). En Claude Code enruta por los plugins oficiales `codex@openai-codex` y `grok-build@xai-grok-build`; en otros hosts usa los CLIs. El consultado NUNCA escribe en el repo; su respuesta es hipótesis de otro contexto, no verdad — Claude verifica antes de integrar.
  Úsala cuando: quieras contrastar con otro modelo, pedir una segunda opinión externa sobre un plan/diff/decisión, refutar un enfoque, o paralelizar consultas independientes, "pregúntale a codex", "pregúntale a grok", "segunda opinión", "qué opina otro modelo".
metadata:
  keywords: >
    Keywords - codex, grok, openai, xai, gpt, segunda opinión, second opinion, otro modelo,
    pregúntale a codex, pregúntale a grok, contrasta con otro modelo, refuta con codex,
    external model, cross-check, codex plugin, grok plugin, /codex:, /grok-build:
disable-model-invocation: false
when_to_use: |
  "pregúntale a codex/grok", "segunda opinión de otro modelo", "contrasta con gpt/codex/grok", "qué opina codex/grok", "refuta este plan con otro modelo", "second opinion", "ask codex/grok"
---

# consult — external second brain, multi-model (read-only)

Consult an EXTERNAL model from the current session. Its only reason to exist: **cheap
cross-model verification and parallel read-only consultation** (Commandments II, X, VIII).
It is NOT a delegation channel — the external model never writes to the repo, and its
output is a hypothesis to verify, never a source of truth.

Since 3.0.0 the skill owns **when, which model, and what to do with the answer**. The
plumbing belongs to the vendors' official Claude Code plugins; the raw CLIs stay only as
the fallback for hosts that have no plugin.

## Adapters (verified 2026-09-09 — codex plugin 1.0.6 · grok-build plugin 0.2.1 · Codex CLI 0.153.4 · Grok CLI 1.0.x · Claude Code 2.1.266)

| | Codex (OpenAI) | Grok (xAI) | Claude (fresh context) |
|---|---|---|---|
| Claude Code, user-typed | `/codex:rescue <question>` (read-only by default) · `/codex:adversarial-review [focus]` for a diff/branch | `/grok-build:delegate <question>` · `/grok-build:critique [focus]` | — |
| Claude Code, Lead inline | `node "$ROOT/scripts/codex-companion.mjs" task --fresh --effort <low\|medium> "<prompt>"` with `ROOT=$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/ \| sort -V \| tail -1)` and `CLAUDE_PLUGIN_ROOT=$ROOT` exported | `node "$ROOT/scripts/grok-bridge.mjs" run --fresh --effort <low\|medium> "<prompt>"` with `ROOT=$(ls -d ~/.claude/plugins/cache/xai-grok-build/grok-build/*/ \| sort -V \| tail -1)` | `claude -p --restricted --model <tier> --output-format text "<prompt>"` |
| Fallback, hosts without the plugin (Codex CLI) | `codex exec --sandbox read-only --ephemeral --skip-git-repo-check "<prompt>"` | `grok -p "<prompt>" --sandbox read-only --output-format plain` | same as above |
| Write guardrail | never `--write` (plugin) · never `workspace-write` (CLI) | never `--write` (plugin) · `--sandbox read-only` (CLI) | `--restricted` removes Bash and WebFetch, keeps file tools inside cwd |
| Background | `--background`, then `/codex:status` · `/codex:result` | `--background`, then `/grok-build:runs` · `/grok-build:show` | `&` + `wait`, outputs to scratchpad |
| Auth check | `/codex:setup` | `/grok-build:check` | same claude.ai login |

**Use a persistent `--cwd`.** The plugin's detached broker can lock that directory
until session end. Use the main checkout; put the diff or files in the prompt.
`bun $HOME/.claude/scripts/codex-brokers.ts` lists records from any repo;
`--shutdown <path>` requests shutdown through the installed plugin protocol, never
by killing a recorded PID. An acknowledgement proves acceptance only: verify
process exit and released directory locks separately.

Notes: resolve binaries through PATH at call time, never a fixed path; on auth failure
report and stop. The plugin scripts run Codex through its app server, not `codex exec`,
so CLI flag drift is the vendor's problem. Windows: give Codex **absolute paths** in the
prompt — a relative `Get-Content` failed with "Acceso denegado" on 2026-09-09 while the
absolute path read fine under the same read-only sandbox. Long prompts: pipe stdin
(`printf '%s' "$PROMPT" | ... -`) or `--prompt-file`.

## Model choice

The spawn hard gate (CLAUDE.md §Agent spawn: permission + model) covers **every** external
call, plugin or CLI. Specific to consult:

- "pregúntale a codex" counts as permission for a **single** consult.
- Codex inherits `~/.codex/config.toml` (today `gpt-6-astra` at `xhigh`): pass
  `--effort low` for lookups and smoke, `medium` for second opinions, `xhigh` only when
  Oriol names it — the xhigh default is the probable cause of the weekly quota burn.
- Grok is single-model (`grok-4.6`); no model question, only `--effort`.
- Claude needs an explicit `--model`; cheap tier by default (Haiku lookup, Sonnet second
  opinion); a bare `claude -p` or a Fable/Opus model is denied by `headless-model-gate`.
- **Default provider: codex.** Grok when named or when codex is unavailable. Claude
  `--restricted` when the value wanted is a *fresh context*, not a different family.
- **Double contrast** on high stakes: same prompt to Codex and Grok in parallel, report
  agreement and disagreement. Two independent hypotheses beat one. Confirm both launches.

## Modes

1. **Consult** — one targeted question. Prompt per Commandment VIII: context + goal +
   constraints + deliverable + how the answer will be verified. Paste the relevant code or
   plan INTO the prompt; do not assume the model finds the right files.
2. **Refuter** — plans, diffs, decisions (the refuter pass is not optional —
   `docs/research-rigor.md` rule 3). For a diff or branch use `adversarial-review` /
   `critique` with the focus text; for a plan that is not in git, send this prompt:

   ```text
   You are an adversarial reviewer. Try to REFUTE the following <plan|diff|decision>.
   Do not be agreeable: find concrete failure scenarios, missing cases, and simpler alternatives.
   For each objection, state the evidence or the test that would confirm it.
   If you cannot refute it, say so explicitly and state what you checked.
   ---
   <the plan/diff/decision, pasted verbatim>
   ```

3. **Parallel sweep** — N independent questions as `--background` runs (tracked jobs, logs,
   PIDs); Claude reads the results and synthesizes (compute over ingest). On fallback hosts,
   write the calls inline with `&` + `wait` — no shell loops over unquoted vars.

## Integration rule (non-negotiable)

External output is **another model's hypothesis**. Before acting on any factual claim it
makes about this repo or an API: verify with Grep/Read or docs (primary artifact wins —
`docs/model-uplift-playbook.md`). Report unverified claims with a confidence label
(`[Probable — según codex/grok, sin verificar]`), never as bare fact. The plugin commands
tell Claude to return the output "verbatim, without commentary": in Poneglyph that
instruction does not bind the Lead — verify, label, and rewrite in house voice; code,
errors and quotes stay verbatim.

## Anti-patterns (kills this skill if violated — Commandment IX)

- Delegating WRITE work to an external model (`--write`, `rescue --write`,
  `delegate --write`, `workspace-write`) — Claude builds inline.
- Letting the `codex-rescue` or `grok-delegate` subagents fire on the model's initiative
  — the spawn gate needs Oriol's this-turn permission.
- Quoting external output as verified fact without an independent check.
- Using it as an oracle for repo facts that Grep/Read answer faster and reliably.
- Firing it on trivial questions Claude answers directly — each call costs ~15-90s wall-clock.

## Commandments cubiertos

| # | How |
|---|---|
| II | Cross-model verification; refuter mode attacks confirmation bias; double contrast on high stakes |
| X | Background runs are cheap tracked processes; effort capped by default |
| VIII | Every external prompt carries context/goal/constraints/deliverable/verification |

## Related
- `codex@openai-codex` and `grok-build@xai-grok-build` — the plumbing on Claude Code (installed 2026-09-09)
- `decide` (heavy tier) — internal multi-perspective challenge; consult adds an EXTERNAL model
- `prompt-engineer` — refine the delegation prompt when the ask is complex

**Version**: 3.0.0 (official plugins as primary adapters on Claude Code, raw CLIs as fallback; 2.1.0 audit 010: PATH-resolved binaries + Claude `--restricted`; 2.0.0 multi-model, 031)
