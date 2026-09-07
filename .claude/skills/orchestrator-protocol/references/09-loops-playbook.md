# Loops Playbook — `/goal` and `/loop` in poneglyph

How to use Claude Code's native autonomous-iteration primitives **without breaking poneglyph doctrine**. This is the reference; the rule of thumb lives in `SKILL.md` Step 4.

> **Origin**: analysis of a "stop prompting, design loops" video (`references/09-loops-analysis-source.md`). The video's *concept* is sound and partly already ours; its *headline mode* (unattended 24/7 self-judging loops) is not. This playbook adopts the compatible part and documents why the rest is rejected.

## The two native primitives (verified against official docs)

| | `/goal <condition>` | `/loop [interval] [prompt\|/cmd]` |
|---|---|---|
| **What** | Keeps the session working **turn after turn** until a stop condition holds | Re-runs a prompt **on a schedule** (or self-paced) |
| **Stop oracle** | A small fast model (Haiku) judges the condition after each turn — reading **only the transcript**, it does **not** run commands or read files | `Esc`, self-pace completion, or 7-day auto-expiry |
| **Scope** | Session-scoped Stop hook; restored on `--resume` (counters reset) | Session-scoped cron; restored on `--resume` if unexpired |
| **Interval** | n/a (immediate next turn) | `s`/`m`/`h`/`d`; omit → self-paced (1m–1h); requires CC running + idle |
| **Cancel / kill** | `/goal clear` (aliases: stop/off/reset/cancel) | `Esc` / `CronDelete` / `CLAUDE_CODE_DISABLE_CRON=1` (global) |
| **Default prompt** | n/a | bare `/loop` → built-in maintenance prompt, or `.claude/loop.md` if present |
| **Versions** | CC 2.1.139+ | CC 2.1.72+ |

Sources: `code.claude.com/docs/en/goal`, `…/scheduled-tasks`. The "Haiku judges, does not execute" mechanic is the conservative design assumption — even if the evaluator could execute, dumping evidence into the transcript (below) stays correct.

## The one rule that makes loops doctrine-safe

**The stop oracle reads only the transcript. So an autonomous loop is only as trustworthy as the evidence it surfaces.** Two consequences:

1. **Use an EXTERNAL, OBJECTIVE oracle — never let the model judge its own work.** This is the video's own "jewel" (maker ≠ auditor, Addy Osmani) and our Commandment IV. Phrase goal conditions against machine-checkable facts and **run the check, printing its output into the conversation** so the evaluator can see it:
   - ✅ `/goal US3 is built and `bun test ./.claude/hooks/` is green and lint is clean and critic verdict is APPROVED — print each command's output before judging`
   - ❌ `/goal keep improving the report until it's perfect` ← model self-judging; unbounded; the exact bias the video warns against.
2. **Bound it.** Add an explicit exit clause (`or stop after N turns`) to every `/goal`; rely on `/loop`'s 7-day expiry plus an iteration/budget cap. Log token spend (cost discipline).

## DAME → poneglyph (the video's framework, already 3/4 ours)

| DAME piece | poneglyph equivalent |
|---|---|
| **D** — trigger | native `/goal` (until-condition) / `/loop` (recurring) — the only piece poneglyph lacked; now adopted, not built |
| **A** — agent (maker) | `build` skill (inline-first) |
| **M** — verifiable meta | `critic` + quality gates + `tdd-design` oracle = the external auditor |
| **E** — state (out of chat) | `state.json`, `plans/`, `memory/`, living-spec loop |

## Doctrine-compatible recipes (ranked value/risk)

### ✅ R1 — Goal-loop over an ALREADY-GATED build→critic (high value, low risk)
The human approved spec/tasks at hard gates 1→2 and 2→3 *before* the loop; the loop only grinds an approved HU to a green, machine-checkable bar.
```
/goal Advance the active /flow plan: for each pending HU in state.json, run build then
critic; stop when all HUs are closed AND `bun test ./.claude/hooks/` is green AND critic
verdict is APPROVED. Print test output and the verdict each turn. Stop after 15 turns.
Never cross an un-approved hard gate — if one is pending, stop and report.
```

### ✅ R2 — Recurring read-only research/audit (medium-high value, low risk)
Read-only ⇒ no destructive-mutation risk ⇒ no human gate needed. The video's "leave it marked for the morning", minus the write risk.
```
/loop 2h Re-run a read-only ultracode-audit pass and append new findings to the audit report.
```

### ✅ R3 — `ScheduleWakeup` / `/loop` to await background work (medium value, ~zero risk)
Poll a CI run / background `Workflow` / remote queue and resume when state flips. Self-paced `/loop` or the `Monitor` tool (more token-efficient than re-prompting).

### 🚫 Rejected — and why (this IS "leveraging the whole video": map each element, adopt or reject with reason)

| Video element | Verdict | Reason |
|---|---|---|
| Loop concept = trigger + verifiable meta + state | **Adopt** (R1–R3) | Sound; mostly already ours |
| maker ≠ auditor (external verifier) | **Adopt as the core rule** | It's Commandment IV; drives "external oracle + evidence in transcript" |
| State outside the chat (files/json/md) | **Already have** | `state.json` / `plans/` / `memory/` |
| `/goal` (closed) and `/loop` (open) triggers | **Adopt natively** | `/goal` + `/loop` are built-in; no component to build |
| Schedule/cron + event triggers | **Adopt where read-only** (R2) | cron via `schedule`/`/loop`; events via Channels — gated/read-only only |
| Open-ended "improve forever" self-judged loop | **Reject** | Model judges itself → violates maker≠auditor AND Commandment III; unbounded |
| Unattended overnight build/write, no gates | **Reject** | Bypasses hard gates 1→2/2→3; re-triggers the inline-first quality regression (017 evidence) |
| Bespoke poneglyph "loops engine" / custom `/goal` command | **Reject** | Native primitives cover R1–R3; rows against `prune > add` (Cmd IX) |
| 4 machines 24/7, ROI 16×, $1M tokens, paid "motor agéntico" | **Out of scope** | Marketing, not load-bearing for "can poneglyph use loops?" |

## Loops + agents: where the evaluator goes blind

`/goal` and `/loop` live in the **main (Lead) session**, not inside agents. The `/goal` evaluator is a session Stop hook reading *"the conversation so far"* and *"does not call tools"* — so it sees the agent's **returned result, never its internal work** (the Agent tool hands back only the agent's final message). Consequences:

- **`/goal` is not per-subagent** (that would be `SubagentStop`); you cannot put `/goal`/`/loop` inside a subagent — they are interactive-session commands.
- **This reinforces inline-first.** A goal-loop is most reliable when the maker runs inline (the Lead surfaces tests/outputs/verdict to the transcript). With write fan-out, the oracle only sees summaries (summary degradation).
- **Rule**: inside a loop, use agents only for read-only fan-out; the Lead must **re-verify inline** anything the stop condition depends on (run the test itself, print the output) — never trust an agent's "I did it".
- **Stronger judge**: don't try to make the Haiku evaluator smarter (its model is the global small-fast slot, no per-goal effort control). Put the strong judgment in a `critic` step (Opus, inline) and let the evaluator only check "is critic's verdict APPROVED?" — a cheap read over evidence already in the transcript.

## Effort selection for loops (Opus 4.8)

On the FrontierCode *diamond* subset (hardest 50/150 — coding), Opus 4.8 is roughly: low ~8 %, med ~6 %, high ~8.7 %, xhigh ~13.4 %, max ~11.4 %. Reading (1 coding benchmark, noisy non-monotonic curve — don't over-fit):

| Effort | For loops on Opus 4.8 |
|---|---|
| **low** | Default for the bulk of iterations — ≈ high quality at ~half the cost. Best for mechanical/verifiable/read-only steps |
| **high** | **Dominated** — low matches it cheaper, xhigh beats it. Avoid for hard tasks |
| **xhigh** | The only real score jump — reserve for the genuinely hard step |
| **max** | *Worse* than xhigh here (overthinking). Avoid |

Effort is **not changeable dynamically mid-session** (the user sets `/effort`; the Lead cannot self-switch). Project policy: skills carry NO `effort:` (they inherit the session = low) **except** the strong-judgment gates `critic`, `security-audit` (xhigh) and the `unstuck` stuck-buster (xhigh); `decide`'s heavy tier escalates effort per-invocation instead. For "low bulk / xhigh on the hard step", route the hard step through one of those skills, or a Workflow agent with per-agent `effort`. When a loop is stuck, `unstuck` is the xhigh rung. Caveat: diamond subset exaggerates effort's value vs everyday tasks, where low suffices even more.

## Guardrails (non-negotiable for any adopted loop)
- **Hard gates are never crossed unattended.** A loop runs *after* a gate, or only on read-only work, or stops and reports when a gate is pending.
- **Objective stop**: tests + lint + critic, OR explicit max-iterations/budget. Print the evidence into the transcript.
- **Kill switch**: `/goal clear`, `Esc`, `CronDelete`, or `CLAUDE_CODE_DISABLE_CRON=1`.
- **Cost**: log token spend per loop run; lean on the 7-day expiry.

## Related
- `.claude/loop.md` — single generic doctrine-safe default for bare `/loop`, synced to `~/.claude/loop.md` (poneglyph is the global source, so one file serves project + global; other repos override locally)
- `unstuck` skill — xhigh stuck-buster for a loop that stops converging
- `references/09-loops-analysis-source.md` — the analysis this playbook operationalizes
- `/flow` command — the gated lifecycle a goal-loop (R1) advances
- `critic` skill — the external auditor / stop oracle
