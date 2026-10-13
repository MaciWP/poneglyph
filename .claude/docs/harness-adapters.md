# Harness Adapters

Poneglyph maintains one doctrine, one skill catalog, and one source for each
command. Host adapters install native entrypoints. Shared procedures do not
guarantee identical model decisions or permission systems.

## Source and installation

| Surface | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Doctrine | Linked core CLAUDE.md | Generated AGENTS.md: doctrine, style, runtime contract | Existing Claude compatibility loads shared doctrine and rules |
| Style | Poneglyph output style | Included once in AGENTS.md | Generated style twin, linked or checked Windows copy |
| Skills | Shared .claude/skills | Each core skill directory links into the selected profile | Existing Claude discovery, without another set of links |
| Commands | Three shared markdown commands | Generated $name skills read the original command | Existing Claude command discovery exposes /name |
| Lifecycle | Shared flow-lifecycle.md | Same phases, artifacts and human gates through $flow-lifecycle | Same phases, artifacts and human gates through /flow-lifecycle |
| Permissions and authentication | Native profile plus ignored overlay | Native Codex configuration | Native Grok configuration and enabled compatibility sources |

The adapter discovers core skill directories from source, excluding links into
optional addons. The core has three commands (`flow-lifecycle`, `expert-role`,
`sync-poneglyph`); commit-message and pr-description live in the private work plugin as skills.
References and scripts stay with their skill. Generated wrappers contain
invocation glue, not independently maintained command bodies.

`docs/harness-runtime.md` resolves resources from the installation. Project
plans and source changes stay in the current project. A Claude tool name does
not provide another host with that API. If a vendor plugin is unavailable,
report the gap and use an available equivalent only where it fulfills the
operation. File search must not be described as semantic LSP inspection.
Claude settings recipes still configure Claude when read from another host.

## Consultations

A bounded, read-only opinion from another model (“Consulta a Codex”) loads
`consult-model`, which returns an opinion for the Lead to verify. The route
depends on the user's action, not on the current host.

For consultations, Claude Code uses the official Codex/Grok plugin bridges; other
hosts use the [CLI adapters](../skills/consult-model/references/adapters.md).
An explicitly requested plugin must be available before that route can proceed;
if it is unavailable, ask before substituting a CLI. Explanations, quoted examples
and hook hints authorize no launch.

Do not replace active global profiles with a development worktree to test
installation; use disposable homes and the existing adapter integration tests.

## Hook contracts and limits

The Claude registrations stay in `settings.global.json`. Native adapters
reuse command judgement, skill matching, the prompt router, the design-file note and
secret detection.

| Shared operation | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Headless command guard | PreToolUse | Native PreToolUse response | Native PreToolUse response |
| Skill hints | UserPromptSubmit context | Native UserPromptSubmit context | Explicit shared routing; UserPromptSubmit takes no context |
| Prompt router (dictation fixes, ≤3 skills) | Async UserPromptSubmit context, mid-turn | UserPromptSubmit starts it detached; the first PreToolUse after it finishes delivers the note once (`$skill`) | Same as Codex (`/skill`); the note arrives with that tool's result |
| Modified-file secret heuristic | Stop warning and explicit review command | Stop user warning and explicit review command | Explicit review command |
| Instruction-load telemetry | InstructionsLoaded | No equivalent installed | No equivalent installed |
| Design-file note | PreToolUse context on the first UI-file contact per session (edit tools, or a UI path in a Bash command); never blocks | Native PreToolUse context on `apply_patch` (paths from `*** Add File:` / `*** Update File:`); needs `/hooks` trust | Not wired |
| Turn reminders (router answer, es-ES note, `harness-config`, question tool) | PostToolUse and UserPromptSubmit context from `turn-nudges.ts`; never blocks | Not wired; duties stay in the doctrine | Not wired; duties stay in the doctrine |
| Git-intent transcript warning | Existing Claude parser | No guessed transcript parser; shared approval doctrine | No guessed transcript parser; shared approval doctrine |

The headless guard covers its existing command patterns. It does not prove
authorization or intercept every worker surface. Native hook failures can fail
open. A registration is not a universal security boundary.

Codex requires review and trust of changed hooks through `/hooks`. Its transcript
format is not stable. This adapter neither grants trust nor forces continuation
to simulate a warning. [Codex hooks](https://learn.chatgpt.com/docs/hooks).

Grok uses camelCase input and a different denial response; its shell tool is
`run_terminal_command`. Only PreToolUse blocks, and only its `additionalContext`
reaches the model, after the tool has run; UserPromptSubmit and Stop output is
dropped. Keep `[compat.claude] hooks = false` and install the native hook once.
Other integrations remain independent.

The router child is the same `prompt-router.ts --host codex|grok` with the same
model through `claude -p`. Its note waits in `<tmp>/poneglyph-router/<session>.note`
for ten minutes; a new prompt drops it. It skips runs launched from a Claude session
(`CLAUDECODE` set), because neither host marks a headless run. A reply that uses no
tool never sees the note. The catalog holds the project's and the core's skills;
memory reuses the Claude index, and only a Claude transcript filters loaded skills.
With the router in place, Codex keeps its skill catalog near names-only
(`[skills] max_context_tokens`, set by sync-codex); Grok keeps its descriptions.
[Grok hooks](https://docs.x.ai/build/features/hooks).

## Install and verify

Preview before execution. Preserve matching links, native settings and other
hooks. Recovery copies stay outside skill discovery roots in the user's Poneglyph
installation-backups directory. Backups are not auto-deleted.

`/sync-poneglyph` is the single entrypoint; detection, engine order, flags and
engine-only options are owned by `.claude/commands/sync-poneglyph.md`. Per-host status
and verification:

```bash
bun .claude/scripts/sync-claude.ts --status      # one host at a time
bun .claude/scripts/sync-codex.ts --status
bun .claude/scripts/sync-grok.ts --status
bun run check:config
bun run doctor --ci
bun run doctor
```

### Shared context/effort policy

All three hosts carry one tiered policy, so a session behaves the same everywhere:
compact at **300k tokens** by default, raise to **400k** per session when a task
needs it, reasoning effort **high** (each host's own default) with the stronger
tier one command away. Source of truth: `.claude/scripts/lib/host-config.ts`.

| Host | Keys written | Default | Raise for one session |
|---|---|---|---|
| Claude | `autoCompactWindow`, `effortLevel` + `modelSettings["claude-opus-5-5"].effortLevel` (settings.global.json; Opus 5.5+ ignore the top-level key in user settings; Opus runs `medium` as a cost experiment) + `modelSettings["claude-haiku-5-5"].autoCompactWindow` 100k, which also reaches Haiku subagents. Also `switchModelsOnFlag: false`, taken from the Opus 5.5 playbook; the official settings reference does not list it (checked 2026-09-23), so its effect is unverified | 300000 (integer; a suffixed string is dropped silently) · high | `/autocompact 400k` · `/effort xhigh` |
| Codex | `model_auto_compact_token_limit`, `model_reasoning_effort`, `plan_mode_reasoning_effort` (config.toml, via `sync-codex`) | 300k · high · plan xhigh | `codex -c model_auto_compact_token_limit=400000 -c model_reasoning_effort=xhigh` |
| Grok | `session.auto_compact_threshold_percent`, `models.default_reasoning_effort`, `model."grok-4.6".context_window` (config.toml, via `sync-grok`) | 60 % of a pinned 500k = 300k · high | `grok --effort xhigh` (per session) |

Grok has no absolute compaction limit, only a percent of the model window, and
left implicit it "assumes 200,000 tokens and mis-times auto-compaction" (its
config guide), so the percent would silently mean 80k. `sync-grok` pins
`model."grok-4.6".context_window = 500000` so `60 %` is a stated 300k; grok-4.6's
window is `[Probable — vendor pages, 2026-09-09]`, and `grok inspect` accepts the
block. Codex and Claude take an absolute token limit directly, so they need no pin.

The Codex policy that actually takes effect is the one `sync-codex` writes to the
profile's `$CODEX_HOME/config.toml`; the repo `.codex/config.toml` carries the
same values for uniformity across checkouts, but a project file only applies in a
trusted project and does not override the profile's own compaction/effort keys.

The sync scripts merge only these keys, preserving every other setting; they
back up `config.toml` before writing (`--backup`, `sync-codex --execute` now
requires `--backup` whenever the policy differs). TOML comments are not preserved
by the round-trip, both live configs on this machine carry none.
`ponytail: comment loss on config.toml rewrite; upgrade trigger = a host config
that needs inline comments preserved.`

Sync shared generated doctrine before account profiles linked to it.
`CODEX_HOME` selects the Codex profile; the default is `~/.codex`.
`sync-grok --home-dir PATH` supports a disposable profile without replacing HOME.
Grok reuses the shared Claude installation, which must be installed first.

Check an unrelated scratch project, repeated-sync stability, native discovery,
and preserved integrations. Test hook input, output and failures without a model.
Complete native trust and human session checks separately. Timeouts, skipped
checks and static listings do not establish successful activation.

Claude settings validation returns 0 for acceptance, 1 for rejection, and 2
when acceptance is unverified. The combined sync preserves warnings and broken
inventory rows. `--no-validate` never establishes acceptance. A nonzero doctor
exit without a settings diagnostic also remains unverified.

The output-shaper hook processes Claude's Bash results only. It does not shape
Codex `exec_command` output, PowerShell-native output, or Grok tool results.
Registration and shared source do not establish cross-host output shaping.

Keep an IDE-observed checkout and its `.git` directory in place during updates.
IDEs use Git metadata to identify their workspaces. Prepare source changes in a
separate review checkout, then use ordinary Git integration after checking for
overlap with local work. A failed directory move can leave a partially moved
repository; never assume that a nonzero exit left the source unchanged.

## Optional private addon and MCP

Work remains an optional machine addon. Activation and its marketplace belong in
ignored `settings.machine.json`. Claude and Grok share its enabled Claude plugin.
Codex profiles link only its unique skills. Do not also install those skills in
`~/.agents/skills`: this produced duplicate Grok discovery. Preserve private
memory and verify the installed cache has no retired Work hook.

MCP endpoints, credentials, enabled tools and permissions remain private machine
configuration. The adapters do not export credentials or establish connections.
Compare services and transport requirements independently: different
host-specific names or loopback ports do not prove different services.
Matching configuration does not prove authentication or connectivity.

### Context7 without an account or API key

Context7 supports anonymous access to public documentation at
`https://mcp.context7.com/mcp`, subject to its anonymous rate limits. The native
Codex configuration is:

```toml
[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"
```

Add this entry to the selected profile's `config.toml`; preserve its other
settings. Configure each opted-in `CODEX_HOME` separately, including the default
profile when it is used. Do not add credentials, an OAuth endpoint, or another
Context7 plugin merely to reproduce the same documentation service. Claude's
existing Context7 plugin and Grok's compatible discovery can remain in place.

Inspect the entry with `codex mcp get context7 --json`, then open a new session
and check `/mcp`. Configuration inspection alone does not prove a connection.
Verify a public-library documentation lookup separately; do not send private
source or incident details. If the anonymous service is unavailable or rate
limited, report that limit and consult the library's official documentation.
Do not silently introduce a paid plan or require a new account.

[Context7 anonymous access](https://context7.com/docs/resources/all-clients),
[Codex native MCP configuration](https://learn.chatgpt.com/docs/extend/mcp).

## Model tiers

Agent authorization and the tier per unit are governed by CLAUDE.md §Agents and
skills. No adapter starts or evaluates a model. Doctrine names capability tiers (cheapest, mid, top), never a model. Resolve the
names from the active host at runtime, never from memory:

- **Claude Code**: the `Agent` tool's own model options list the live tiers. Pick
  one explicitly on every spawn; never let a spawn inherit the session model silently.
- **Codex**: the CLI's configured model is the baseline (run without `-m`). Pass
  `-m` only for a tier the user named, and never name a tier the host does not expose.
- **Grok Build**: inspect `grok models` / `grok --help` and use an approved model
  with a supported effort. On a single-model host, model choice is N/A; say so.
