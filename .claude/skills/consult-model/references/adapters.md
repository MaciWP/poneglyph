# Consultation adapters

Read this reference before an authorized consultation. Select the route using
[rules/skill-routing.md](../../../rules/skill-routing.md). An explicitly requested
plugin must be available; report a missing plugin instead of silently using a CLI.

## Verified bridge snapshot (bridges re-read 2026-09-11 — codex plugin 1.0.6 · grok-build plugin 0.2.1 · Codex CLI 0.153.4 · Grok CLI 1.0.x · Claude Code 2.1.266)

| | Codex (OpenAI) | Grok (xAI) | Claude (fresh context) |
|---|---|---|---|
| Claude Code, user-typed | `/codex:rescue <question>` (read-only by default) · `/codex:adversarial-review [focus]` for a diff/branch | `/grok-build:delegate <question>` · `/grok-build:critique [focus]` | — |
| Claude Code, Lead inline | `node "$ROOT/scripts/codex-companion.mjs" task --fresh --effort <low\|medium> --prompt-file <file>` with `ROOT=$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/ \| sort -V \| tail -1)` and `CLAUDE_PLUGIN_ROOT=$ROOT` exported | `node "$ROOT/scripts/grok-bridge.mjs" run --fresh --effort <low\|medium\|high> --prompt-file <file>` with `ROOT=$(ls -d ~/.claude/plugins/cache/xai-grok-build/grok-build/*/ \| sort -V \| tail -1)` | `claude -p --restricted --model <tier> --output-format text "<prompt>"` |
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
absolute path read fine under the same read-only sandbox.

**Passing the prompt** (bridge sources read 2026-09-11). Write it to a file and pass
`--prompt-file <path>` — both bridges accept it (`codex-companion.mjs:644`,
`grok-bridge.mjs:592`) and it is the only form that does not depend on the shell. Windows
caps one command line at 32,767 characters (`cmd.exe` at 8,191), which binds the Lead's own
invocation; Grok pays it twice, re-passing the prompt to its CLI as `-p <prompt>` argv
(`lib/grok.mjs:166`), while Codex uses the app server. Two traps in the shared parser
(`lib/args.mjs`): a trailing `-` is a POSITIONAL, not stdin, so `… | node bridge task -`
sends the literal prompt `-` (piped stdin works only with no positional at all); and an
unrecognised `--flag` is appended to the prompt instead of raising an error.
