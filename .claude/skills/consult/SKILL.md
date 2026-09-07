---
name: consult
description: |
  Consulta a un modelo EXTERNO (OpenAI Codex o xAI Grok, CLIs headless) o a una instancia Claude de contexto fresco en modo `--restricted` como segundo cerebro: preguntas puntuales, segundas opiniones/refutación de planes o diffs, sweeps paralelos read-only, o contraste doble (dos modelos sobre la misma pregunta). El consultado NUNCA escribe en el repo (sandbox read-only forzado); su respuesta es hipótesis de otro contexto, no verdad — Claude verifica antes de integrar.
  Úsala cuando: quieras contrastar con otro modelo, pedir una segunda opinión externa sobre un plan/diff/decisión, refutar un enfoque, o paralelizar consultas independientes, "pregúntale a codex", "pregúntale a grok", "segunda opinión", "qué opina otro modelo".
metadata:
  keywords: >
    Keywords - codex, grok, openai, xai, gpt, segunda opinión, second opinion, otro modelo,
    pregúntale a codex, pregúntale a grok, contrasta con otro modelo, refuta con codex,
    external model, cross-check
disable-model-invocation: false
when_to_use: |
  "pregúntale a codex/grok", "segunda opinión de otro modelo", "contrasta con gpt/codex/grok", "qué opina codex/grok", "refuta este plan con otro modelo", "second opinion", "ask codex/grok"
---

# consult — external second brain, multi-model (read-only)

Consult an EXTERNAL model headlessly from a Claude Code session. Its only reason to
exist: **cheap cross-model verification and parallel read-only consultation**
(Commandments II, X, VIII). It is NOT a delegation channel — the external model never
writes to the repo, and its output is a hypothesis to verify, never a source of truth.

## Adapters (verified 2026-09-02 — Codex CLI 0.144.6 · Grok Build 1.0.13 · Claude Code 2.1.258)

Resolve every binary through PATH at call time (`command -v codex`, `command -v grok`,
`command -v claude`) — never a fixed path. Install locations differ per machine
(macOS: `~/.local/bin/*`; Windows: `%LOCALAPPDATA%/Programs/OpenAI/Codex/bin/codex`,
`~/.grok/bin/grok`). If `command -v` finds nothing or auth fails: report and stop —
never retry auth loops, never guess a path.

| | Codex (OpenAI) | Grok (xAI) | Claude (fresh context, CC ≥2.1.248) |
|---|---|---|---|
| Headless call | `codex exec --sandbox read-only --ephemeral --skip-git-repo-check "<prompt>"` (CLI-configured default model; add `-m <tier>` only when the user named one) | `grok -p "<prompt>" --sandbox read-only --output-format plain` | `claude -p --restricted --model <tier> --output-format text "<prompt>"` |
| Write guardrail | `--sandbox read-only` (OS-enforced) — NEVER `workspace-write`/`danger-full-access` | `--sandbox read-only` (OS-enforced: FS write solo `~/.grok/`, red de hijos bloqueada) | `--restricted`: removes Bash/code-execution tools and WebFetch, keeps file tools inside the cwd, refuses `bypassPermissions`, ignores user/project/local settings (so no hooks, no output style, no `permissions.allow`) |
| Auth | ChatGPT session (`codex login status`) | Browser login / `XAI_API_KEY` | Same claude.ai login as the session |
| Output contract | stderr = progress, stdout = final message | stdout plano con `--output-format plain` | stdout = final text |
| Long prompts | pipe stdin: `printf '%s' "$PROMPT" \| codex exec ... -` | pipe stdin igual, o fichero temporal en scratchpad | pipe stdin: `printf '%s' "$PROMPT" \| claude -p --restricted ...` |
| What it adds | A different model family | A different model family | The **same** family with **zero shared context** — the cheapest way to break the author's confirmation bias without leaving Claude Code |

Notes: the npm codex build is broken (missing native binary) — use the CLI the
desktop app or orca installed. On macOS the Bash sandbox kills these processes
(exit 137) — run them with the sandbox disabled; the CLI's own read-only mode IS the
guardrail. `codex exec --full-auto` was removed in 0.147 (never used here).

## Model choice

The spawn hard gate (CLAUDE.md §Agent spawn: permission + model, tiers resolved from the host at runtime) covers **every** external call. What is specific to consult: "pregúntale a codex" counts as permission for a **single** consult; Codex runs on its CLI-configured model unless the user names a tier this turn (`-m`); Grok is single-model (say so, no model question); Claude needs an explicit `--model` — propose the tier by unit class and wait for the pick; the default proposal is the cheap tier (Haiku for a lookup, Sonnet for a second opinion), and Fable only when Oriol names it (a bare `claude -p` or a Fable/Opus model without `--allow-expensive` is denied by the `headless-model-gate` hook, plan 033).

- **Default provider: codex** (established baseline, evidence history in this repo).
- **Grok**: when the user names it, or when codex is unavailable.
- **Claude (`--restricted`)**: when the value wanted is a *fresh context* rather than a different model family — e.g. refute a plan this session wrote — or when neither external CLI is installed/authenticated on the machine.
- **Double contrast**: for high-stakes second opinions, fire BOTH on the same prompt in
  parallel and report agreement/disagreement — two independent external hypotheses beat
  one (still hypotheses, still verified before integrating). Confirm both launches first.

## Modes

### 1. Consult (default) — one targeted question

Build the prompt per Commandment VIII: **context + goal + constraints + deliverable +
how the answer will be verified**. Paste the relevant code/plan INTO the prompt — do
not assume the external model will find the right files; give it the material.

### 2. Second opinion / refuter — plans, diffs, decisions

Use the external model as refuter (the refuter pass is not optional — `docs/research-rigor.md` rule 3). Template:

```text
You are an adversarial reviewer. Try to REFUTE the following <plan|diff|decision>.
Do not be agreeable: find concrete failure scenarios, missing cases, and simpler alternatives.
For each objection, state the evidence or the test that would confirm it.
If you cannot refute it, say so explicitly and state what you checked.
---
<the plan/diff/decision, pasted verbatim>
```

### 3. Parallel sweep — N independent questions

Headless background OS processes (not subagents; the spawn tree does not apply).
Outputs go to scratchpad files; Claude reads and synthesizes (compute over ingest).
No zsh word-splitting loops over unquoted vars (a real zsh failure, 2026-08) — write the calls inline:

```bash
OUT=<scratchpad-dir>
# binaries resolved through PATH; CLI-configured default model for codex, add -m <tier> only when the user named one
codex exec --sandbox read-only --ephemeral --skip-git-repo-check "<q1>" > "$OUT/c1.out" 2>/dev/null &
grok -p "<q2>" --sandbox read-only --output-format plain > "$OUT/g1.out" 2>/dev/null &
claude -p --restricted --model <tier> --output-format text "<q3>" > "$OUT/k1.out" 2>/dev/null &
wait
```

## Integration rule (non-negotiable)

External output is **another model's hypothesis**. Before acting on any factual claim it
makes about this repo or an API: verify with LSP/Grep/Read or docs (primary artifact
wins — `docs/model-uplift-playbook.md`). In prose, report unverified claims with a
confidence label (`[Probable — según codex/grok, sin verificar]`), never as bare fact.

## Anti-patterns (kills this skill if violated — Commandment IX)

- Delegating WRITE work to an external model (implementation, edits) — Claude builds inline.
- Quoting external output as verified fact without an independent check.
- Using it as an oracle for repo facts that Grep/LSP answer faster and reliably.
- Firing it on trivial questions Claude answers directly — each call costs ~30-90s wall-clock.

## Commandments cubiertos

| # | How |
|---|---|
| II | Cross-model verification; refuter mode attacks confirmation bias; double contrast on high stakes |
| X | Parallel sweeps are cheap background processes |
| VIII | Every external prompt carries context/goal/constraints/deliverable/verification |

## Related
- `decide` (heavy tier) — internal multi-perspective challenge; consult adds an EXTERNAL model
- `prompt-engineer` — refine the delegation prompt when the ask is complex

**Version**: 2.1.0 (audit 010: PATH-resolved binaries + Claude `--restricted` adapter; 2.0.0 multi-model, 031 — was `codex-consult` 1.0.0)
