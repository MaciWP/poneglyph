---
parent: dev-workflow
name: critic-loop
description: How the Lead briefs the `critic` agent, answers its findings and settles disputes, and what the critic gate counts as a review.
---

# Critic loop (Claude Code)

The `critic` agent (`.claude/agents/critic.md`, Opus, effort medium, read-only git shell) reviews
with a clean context. The Lead briefs it, waits for the result, and answers every finding.

## When

| Moment | Mode | Enforced by |
|---|---|---|
| Before `ExitPlanMode` | `plan` | `critic-gate.ts` denies the exit |
| Before a workboard feature (a task without `parent`) goes `completed` | `feature` | Doctrine only: hooks do not see the mod's tool |
| End of a turn that changed files, workboard or not | `feature` | `critic-gate.ts` blocks Stop once, then warns "Cierre sin revisar" |
| A design doubt with real options | `doubt` | Doctrine only |

No size exemption: a one-line change is reviewed too. Working notes (plans, memory, scratchpad,
`/tmp`) are not reviewable edits.

## Launch

`Agent(subagent_type: "critic", prompt: <brief>)` with **no** `model` or `effort`: the agent file
pins them, and `router/agent-hooks.ts` strips them if passed. Each block opens its own line as
`MODE:`, `GOAL:` and so on. The first three are required: the hook denies a launch whose `MODE:`
does not start with one of its three values, or whose `GOAL:` or `ARTEFACT:` is empty. Send the
others only when they have content.

| Block | Content |
|---|---|
| `MODE` | `plan`, `feature` or `doubt` |
| `GOAL` | The user's own words, quoted verbatim. Never a paraphrase |
| `ARTEFACT` | `plan`: the plan path. `feature`: the paths the change touched, which the critic reads in the working tree, or a commit range (`<base>...<head>`). `doubt`: the question and its options |
| `DOD` | The agreed definition of done |
| `USER-DECISIONS` | Only decisions the user took, each with its quote |
| `AUTHOR-PROPOSALS` | What the author proposed, marked as proposals, never as constraints |
| `PATH` | Rejected alternatives in one clause each, sources consulted, neighbour files the pattern came from |
| `CHECKS` | The commands run and what each printed, with no conclusion. The critic cannot run tests: it judges this as the author's claim |

The hook appends `USER-PROMPTS` from the transcript: what the user typed, prompts and
`AskUserQuestion` answers alike, the first entry and the last four. The critic holds `GOAL` and
`USER-DECISIONS` against it.

Forbidden in the brief: an opinion on the work ("I think it's fine", "already verified"), an
instruction about what to check, what to skip or how to reply, the author's reasoning beyond
`PATH`, and other critics' output. Name the author neutrally ("the author").

## Answer

Right after the result, one row per finding, using the critic's ids. For a plan, write them into
the plan file under `## Critic answers` (Edit, MultiEdit, Write or a Bash heredoc), then call `ExitPlanMode`. Only
lines the call adds count, so rows left from an earlier review never answer a new one, and adding
only rows is not a plan change that needs another review. For a feature,
put them as visible text in the reply. The gate does not see rows in thinking or in a summary
sentence, and a table without ✅ or ❌ is not a set of answer rows.

```text
REVIEW-ID: feature-1a2b3c4
| H1 | ✅ aceptado | <fix made, file:line> |
| H2 | ❌ en disputa | <evidence that refutes it> |
```

- ✅ aceptado: the fix is made before moving on, or scheduled in the plan with its trigger.
- One row may answer several ids when they start it (`| H9, H10 | ✅ aceptado | … |`).
- ❌ en disputa (also `rechazado`, `no aceptado`): needs evidence, not preference, beyond the
  choice words; a bare ❌ does not count. The gate reads the last row with a choice for each
  finding. A disputed blocker or major goes to the user through `AskUserQuestion`; the user
  settles it, never the Lead.
- Every finding is applied, minors and style included: the critic holds the repository's quality
  bar. A ❌ on any severity needs evidence that the fix is wrong here (it breaks a user decision,
  a repo rule, or behaviour), never "too small".
- `QUESTIONS` asking for a command: run it and put the output in the row of the finding it settles.
- `VERDICT`: `BLOCK` is a blocker, `REVISE` a major, `PROCEED` neither. Minors come one line
  each under any verdict, and each still needs its row.
- `VERDICT: BLOCK`: fix it, then launch one more review of the fix (see Freshness).

## What the gate counts

A review counts when the critic's result was delivered complete with `VERDICT` and a `REVIEW-ID`
of the expected mode, it ran on `claude-opus-5-5`, and every `H#` has its `| H# |` row after the
delivery and before the next review's. A spawn that is pending, killed, partial, denied for its
brief or of another mode does not count. The gate checks that the row exists, not that the fix
was made or that a dispute reached the user: both stay the Lead's duty.

**Freshness.** One review per moment. Fixes after a `PROCEED` or `REVISE` stay covered at any size
until a new turn opens (a human prompt, or a courier or peer message delivered while idle); the
new turn's edits need their own review. After a `BLOCK`, the fix needs one more review; never
more than two reviews of a mode per turn, so a second `BLOCK` goes to the user through
`AskUserQuestion`, not to a third run; the gate then lets the fix pass with a "Tope de revisiones"
warning. A plan written in a later turn needs its own review, like any later edit.

`PONEGLYPH_CRITIC_GATE=0` turns the gate off, `=1` forces it on. Default: on, except headless
sessions (`claude -p`, SDK, evals) and a session whose first prompt carries `[critic-gate: off]`
(a worker whose orchestrator reserves review for a person; logged as `optout`).
Log: `<project>/.claude/learned/critic-gate.log`.

## Other hosts

Codex and Grok have no `critic` (`docs/harness-adapters.md`). Fallback: `consult-model` in
refutation mode with the same brief, asked first like any unrequested other-provider call.
