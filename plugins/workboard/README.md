# Workboard

Native Claude Code mod: a compact work/quality band above the prompt and one pane for
completed work, decisions, active tasks, agents and the latest ROBIN summary. No external
web UI or extra service. Agentic OS is an optional local bridge for related repositories
and sessions; the mod works with local Git while that bridge is offline.

## Load

Requires Claude Code **2.1.292** (the build exercised by the native engine tests), Node,
Git, and optionally an authenticated `gh` for PR/CI data. The mod API is early access.

Start an interactive terminal session with:

```sh
claude --plugin-dir /absolute/path/to/poneglyph/plugins/workboard
```

This is an activation command for the user, not a verification probe to run automatically.
For every session, Poneglyph's root `.claude-plugin/marketplace.json` lists the mod; enable
`workboard@poneglyph` in the machine overlay and run `sync-poneglyph`. Claude reads it from
this folder, so edits apply to new sessions without a version bump. `/workboard` toggles the pane. Claude
places it on the right in a sufficiently wide fullscreen terminal; narrow terminals may
place it above the prompt or leave it unplaced. The band and pane use native buttons and
inputs: a click presses them in the fullscreen terminal; by keyboard, focus with Claude's
`ctrl+x tab`, move with Tab, activate with Enter, leave with Esc. In the band, `p` opens or
closes the pane («Cerrar panel» while it is open) and `a` refreshes; a refresh ends with a toast
that says whether it worked.
Opening/updating the pane does not request keyboard focus.

The band displays at most two repositories until expanded. A file's **Ver cambio** button
shows its current text/diff inside the same pane; **Volver al trabajo** restores the board.
The detail is capped at 9000 characters and labels truncation. It never edits files.

`ccstatusline.minimal.json` is an optional two-line preset derived from Poneglyph's current
configuration: model/effort/context and account limits. Keep the existing statusline until
the board is visible in your terminal, then select this preset in your ccstatusline setup.
The mod does not silently replace the global statusline or remove its fallback.

## Repository configuration

Only the person invoking `/workboard-config` in Claude's composer can configure commands.
Configuration lives outside the repository, keyed by its canonical path, in
`~/.claude/workboard/projects/`. `CLAUDE_CONFIG_DIR` and `WORKBOARD_HOME` can override that root.

Example (substitute the repository's actual coverage command):

```text
/workboard-config {"ticket":"ABC-123","base":"main","coverage":{"report":"coverage/lcov.info","format":"lcov","command":["bun","test","--coverage","--coverage-reporter=lcov"],"exclude":["coverage"]},"linked":["/absolute/path/to/related/repo"]}
```

Omit `ticket` to infer it from the branch, `base` to use the PR base/default branch, and
`linked` to use only discovered Agentic OS repositories/current checkout. At most twenty
explicitly linked repositories are accepted. Configuration merges supplied fields.
Each related repository needs its own coverage configuration.

Without a `coverage` entry, Workboard detects pytest-cov writing XML: `--cov-report=xml[:path]`
in the pytest options of `pytest.ini`, `pyproject.toml`, `setup.cfg` or `tox.ini`. The report is
that path (default `coverage.xml`, Cobertura) and the command is `.venv/bin/pytest` when the
repository has one, else `pytest`. An explicit configuration always wins; other tools need it.
Cobertura filenames relative to a `<source>` directory inside the repository are resolved
against it. Changed files of a kind the report never measures (`.json` beside `.py`) do not
count as missing; the band then shows the percentage of what was measured and how many changed
files the report misses.

A coverage command is an argv array, spawned without a shell. No tests run during polling.
**Recalcular cobertura** opens a separate shell terminal in Agentic OS when its location
is known, or macOS Terminal when standalone. Linux/Windows need the Agentic OS bridge for
that button. Terminal creation is preceded by an exclusive per-repository lease; uncertain
launches are not retried automatically. Node is inherited from the host's PATH.

Coverage supports LCOV and Cobertura with repository-relative file paths (or absolute
paths inside the repository). Executable added/modified lines form the change denominator;
whole-file coverage is separate. Files absent from the report prevent a misleading complete
aggregate: the per-file evidence remains available. Binary/deleted files do not contribute
new executable lines. No changes/no executable lines means no percentage, not 100%.

A baseline is optional:

```json
{"coverage":{"report":"coverage/lcov.info","format":"lcov","baseline":{"report":"coverage-baseline/lcov.info","revision":"FULL_BASE_COMMIT_SHA","format":"lcov"},"command":["your-test-command"],"exclude":["coverage","coverage-baseline"]}}
```

The user supplies the baseline report and declares the exact commit it represents. The
before→after comparison appears only when that revision equals the calculated merge base;
this is declared baseline provenance, not a baseline test run performed by Workboard.
Keep the baseline report separate from the current report. No fabricated before value.
Only explicit output exclusions are omitted from the code fingerprint; the report's
parent directory is **not** implicitly excluded. Do not exclude source directories.

A report Workboard did not produce reads «informe externo», with its time and how many changed
files are newer than it. A report is current only after a successful Workboard run regenerates it, its digest still
matches, and the repository fingerprint is unchanged from start through observation. An edit
during/after testing, an old report, a failed command, partial instrumentation and a missing
report are distinct states. Completion of an AI task never turns checks green.

## Plans, decisions and ROBIN

The `mcp__workboard__progress` tool publishes explicit tasks (`id`, `title`, `state`, optional
`dependsOn` and `parent`) and decisions (`id`, `question`, `options`, `blocking`, optional
`context`, `recommended`). A task with `parent` is a subtask of that feature, one level deep;
the instruction asks for 2–6 features with 2–6 checkable subtasks each. An option is a label or
`{label, detail}`; `recommended` is the advised option's index and shows as `★`. The id `chat`
is reserved. Tasks merge by id: an update sends only the tasks that change, and an existing task needs only
`{id, state}`; a new one needs `title` and `state`. `replace: true` starts a new plan. The
instruction asks to publish the plan before work starts, update it when a feature closes or
something blocks or fails, and close it at the end, so the chat carries few, short calls. The tool does not infer a plan from chat or invent task progress. File attribution is labelled as initially present,
observed through editing tools, or unknown; shell edits are not attributed to the model.
The tool answers with JSON text (core rejects a plain object from a mod tool's hook): `accepted`
and the decisions still open (`pending`, `queued`, `failed`) with their id, state and revision.

While the mod is loaded, a `tool.describe` hook keeps this one tool's schema in the prompt
instead of behind ToolSearch, and a `prompt.submit` line asks the model to publish its task
list before the first other tool call when the task edits files or needs more than two tool
calls. Without the mod neither exists, and both texts are fixed, so the prompt cache holds.
Measured on 2.1.292 with the same build task: Sonnet published the plan unprompted and closed
it at the end; Haiku received the same line and skipped it. Both publish when asked. A
read-only summary usually gets no plan, which matches the instruction.

When a turn ends with the house style's `Espera tu decisión:` block, that question becomes the
`chat` decision with a free-text answer that goes through the same queue; the next turn without
the block cancels it. `AskUserQuestion` stays a native dialog. The last `Aviso:` line and the
turn's duration, edits and commands show under ROBIN.

Decision revisions reject obsolete responses and duplicate clicks. A button/free-text answer
is saved as queued. While a turn is active, independent work continues; delivery starts after
completion. A host-accepted next prompt counts as delivered, **not proof the model understood
or acted on it**. After an interrupted delivery/reload, inspect the chat before manually
retrying. Blocking decisions instruct the model to stop dependent work; this is a workflow
contract, not a new permission/security boundary. Native tool/agent/Git approvals stay native.

Only the final standalone `ROBIN:` line is relocated, and only while its replacement pane is
shown and placed. Quotes, fences and older summaries remain in the chat. Stored transcripts
and `turn.complete` text remain unchanged. Closing the pane, viewing a diff or insufficient
placement keeps ROBIN in the chat. The pane shows the latest summary separately from observed
failures. Native render exceptions fall back to normal rendering.

## One pane per terminal

ROBIN, Plan, Quality, Decisions and the history show only this session's data, even when
Agentic OS knows other sessions in the same repository. The Agents card is the only view
outward, and it lists only sessions linked to this one:

| Section | Source |
|---|---|
| A su cargo | `$.agent.list()` (subagents and teammates) and Agentic OS consultations this terminal created |
| Conversa con | Native `session.send` / `session.receive` and Agentic OS messages from or to this terminal |
| Últimas comunicaciones | The four latest messages, replies, agent launches and consultations; under 60 s reads «nuevo» |

The header names the mode: «Trabaja sola», «Dirige N», «De tú a tú · nombre» or «En grupo ·
N sesiones» (two or more partners, or one partner that also messages another of them).
`session.receive` takes the sender from a team mailbox or from the `from-name` of the
cross-session envelope; without either it shows as «otra sesión». A partner reached through
both Agentic OS and native messages counts once: `scripts/workboard.mjs` maps native names to
Agentic OS terminals through Claude Code's session registry (`~/.claude/sessions/<pid>.json`,
never the `.key` files). That registry is undocumented; if it changes, only the merge is lost.
«A su cargo» lists agents still running and those stopped in the last 30 minutes; older ones
move to the history. Under each agent a dim line says how it ran: the model it ran on
(`agent.spawn`, then the usage of its turns), the Agent call's `effort`, and the time and
tokens its turns reported (`turn.complete` with its `agentId`; tokens count input, output and
cache, so they read as volume processed, not cost). Turns of engine forks no agent list names
are ignored.
A message between the main loop and one of its agents, or between two agents, is internal:
`session.send` logs it with the sending loop's `agentId` and never counts the agent as a
partner, so the header keeps «Dirige N». An agent writing to an address no agent holds is
taken as writing to main; main's copy of that delivery (same text, within 60 s) is not logged
again. The agent's row shows its latest internal message and «espera respuesta» while its
last one went to main unanswered.
The message hooks only observe: the delivery passes unchanged and they never wait on the prompt.
Agentic OS data is filtered by `AOS_AGENT_ID` inside `scripts/workboard.mjs`, so a session
outside an Agentic OS terminal sees only its native links. At most 50 events stay per session.

## Agentic OS bridge

Agentic OS exposes `/api/workboard/context`, `/session`, `/response` and `/ack`; the Agents
card also reads the existing `GET /api/coordination` and `GET /api/terminals`. Its existing
local Host/Origin guard and local-desktop restriction apply. `AOS_URL` must be a loopback
HTTP origin. `AOS_AGENT_ID` identifies an existing running managed agent terminal; it is local
attribution, **not authentication against malicious local processes**. The bridge stores
bounded session state in the existing data directory, without a database migration.

Repository discovery uses configured checkouts/worktrees, environment checkouts and known
sessions. A session started in a ticket environment folder, which holds one checkout per
repository but is not a repository itself, uses those checkouts (one level, at most twenty). Ticket matching is exact (`ABC-12` never matches `ABC-123`). Only related changed
repositories are displayed, or the current checkout when none has changes. No entire-disk scan.
The mod still publishes its session for the Agentic OS web app, but its pane no longer draws
other sessions' plans, decisions or terminals. This package supplies **only a Claude native
UI**.

Data refreshes every fifteen seconds; GitHub reads are cached for sixty seconds and repository
work is bounded to four concurrent reads. PR reviews and CI always carry the published head:
local edits or an unpushed head cannot borrow a green remote verdict. Missing GitHub credentials,
a missing PR/base and an offline bridge are explicit. Provider calls are read-only.

The Agentic OS server changes need its normal approved restart before the live app exposes the
new routes. The mod never restarts that server.

## Verification and recovery

```sh
claude plugin validate plugins/workboard
claude plugin test plugins/workboard
bun test plugins/workboard/tests/*.spec.ts
```

`*.test.ts` uses Claude's deterministic engine kit; `*.spec.ts` uses Bun and temporary Git
repositories. Engine tests validate native trees, hooks, controls and delivery with stubbed
host/provider operations. They do not launch a model or prove Ink painting in a real TTY.
Agentic OS tests include real loopback HTTP requests and persisted response/ack round trips.

Run state/leases are in `~/.claude/workboard/runs/`; generated terminal scripts are in
`launches/`. A crash can leave a lease. Inspect its recorded PID/terminal and confirm the
command stopped before manually removing that lease. There is no automatic stale-lock takeover.
A launch that fails with uncertain delivery retains its lease to prevent duplicate execution.
