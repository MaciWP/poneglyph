# Configuration source quality

Status: PR #3 implementation candidate. Sources checked 2026-09-07.
This gate checks repository source, not agent performance or a running installation.

## Run and ownership

```bash
bun install --frozen-lockfile
bun run check:config
bun run check:config --root /absolute/path/to/private-addon
bun run check:config --staged
bun run doctor --ci
```

One implementation: [check-config.ts](../scripts/check-config.ts).
[Pre-commit](../scripts/pre-commit.ts), [doctor](../scripts/doctor.ts), and
[CI](../../.github/workflows/ci.yml) use that implementation. The private addon
invokes it from a reviewed core checkout, without a copied package or test suite.

Installation runs Husky through `prepare`. Existing Git hook integrations need
review before installation: Husky changes this checkout's `core.hooksPath`.
The hook checks the complete Git index, not just working-tree versions of changed
files. It preserves the existing core tests and optional native plugin validation.
The tests still exercise working source; they are not an isolated staged build.

The root `action.yml` exposes this same validator to addon CI with a `root` input
relative to the workflow workspace. Call `MaciWP/poneglyph@<reviewed-full-SHA>`.
The action installs the core's locked dependencies without lifecycle scripts.
GitHub downloads remote actions without Git metadata, so the action initializes
temporary local metadata for the core skill inventory; it makes no commit or fetch.
The addon must already be checked out as a Git repository. No addon code executes.
Private consumers need the core's explicitly enabled private-action sharing policy;
GitHub supplies a temporary installation token, without a personal token secret.
This does not configure required branch protection or prove automatic CI triggers.

Working-source mode reads tracked files and non-ignored additions. Deleted files
do not count. It also catches ignored skill entrypoints. Staged mode reads frozen
Git object IDs, including staged deletions and excluding unstaged repairs.
Neither mode changes the index, follows source links/junctions, reads sibling
private checkouts from the core, starts hooks/MCP servers, or calls a model.

Exit codes: **0** no blocking violations, **1** blocking violations, **2** incomplete
validation. Warnings remain visible. A missing repository or empty skill inventory
cannot pass.

## Enforced contracts

| Surface | Blocking rule | Basis |
|---|---|---|
| Skill entrypoint | YAML mapping, matching name, non-empty instructions, required description | [Agent Skills specification](https://agentskills.io/specification); requiring metadata is also the local convention |
| Name | 1-64 characters, ASCII lowercase kebab-case, no name collisions | Portable naming subset chosen by this project; not a claim that every host rejects Unicode |
| Description | Non-whitespace string, 1-1024 Unicode code points after YAML decoding | [Agent Skills specification](https://agentskills.io/specification); no invented 150-character target |
| Optional metadata | String-to-string `metadata`, compatibility up to 500 characters, documented field types | Agent Skills baseline plus [Claude fields](https://code.claude.com/docs/en/skills) |
| Commands | Description and metadata types; derived filename allowed as name; no skill shadowing | Project contract for existing Claude Markdown commands |
| References | Explicit relative Markdown links outside code examples resolve within the snapshot | Project consistency check; arbitrary prose, computed paths and shell arguments need review |
| JSON/YAML/TOML | Parse configuration as a mapping | Native JSON/Bun YAML; pinned `smol-toml` for TOML |
| Claude settings | Hook registration shape, handler types, timeout/async types, explicit core script targets, permission/env/plugin map types | [Claude hooks](https://code.claude.com/docs/en/hooks); project settings stay hook-free |
| Plugin | Name/version/skill paths and marketplace basic shape | [Claude plugin contract](https://code.claude.com/docs/en/plugins-reference); not an exhaustive marketplace schema |
| MCP | Command XOR valid HTTP(S) URL; argument/env/header types; no credentials embedded in URLs | Common structural subset; no connections or authentication |
| Private addon | Unique skills, memory/references, minimal manifests and optional test integration; no shared doctrine, agents or hooks | Approved core/addon boundary |
| Source boundary | No linked source, path case collisions, machine-private configuration, ignored skill entrypoints or binary configuration | Project privacy and Windows portability policy |

Descriptions are decoded before measurement, including folded/literal YAML and
CRLF. The original scalar length is measured without trimming away padding.
Commands follow the same description bound as a **project convention**, not a
universal command limit.

A body of at least 500 lines is a **warning**, not a failure. It is progressive
disclosure guidance, not evidence of poor reasoning. Unknown metadata also warns:
a host extension needs review, but the gate must not forbid valid future fields.
Claude's default description/when_to_use listing budget is separate from the
portable description limit. Do not confuse bytes on disk, available context,
loaded instructions, and billed tokens.

The TOML dependency is deliberate: Bun 1.3.14 accepts `[broken` as a table.
A negative regression requires rejection. [smol-toml](https://github.com/squirrelchat/smol-toml)
rejects that case; its documented date/UTF-8 limitations still apply. This is not
a proof of full parser compliance or a replacement for native host schemas.

## Host boundaries

| Host | Shared layer | What this gate does not promise |
|---|---|---|
| Claude Code | Core doctrine, skills, commands and native global hooks | Effective permissions, hook execution, model availability or skill activation |
| Codex | Existing adapter's five portable skills and global `AGENTS.md` | Automatic use of Claude hooks, slash commands or permissions |
| Grok Build | Skills and explicitly selected native/compatibility configuration | Identical meaning of Claude metadata or equivalent workflow runtimes |

Codex discovers user skills from `~/.agents/skills` and supports linked skill
folders. Work is an optional per-machine addon, available across that user's
projects after explicit installation. Its links stay outside publishable source.
The source gate rejects links **in a publishable snapshot**, not local host
discovery itself. [Codex skill discovery](https://learn.chatgpt.com/docs/build-skills)

Keep one source of shared doctrine. Codex's existing generated global adaptation
is not a second independent policy. Do not add `CLAUDE.md` or `AGENTS.md` to Work.
[Codex instruction hierarchy](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

Grok's compatibility settings can load user-level Claude configuration, including
hooks and MCPs. User-wide Work availability is intentional on an opted-in machine.
Review duplicate discovery and native permissions separately. Private repository
access does not prevent an agent from copying private knowledge into public work;
publication checks and review remain necessary.
[Grok settings](https://docs.x.ai/build/settings/reference),
[Grok skill contracts](https://docs.x.ai/build/features/skills-plugins-marketplaces)

No versioned Codex/Grok config or MCP file is fabricated just to satisfy a test.
When one enters the checked root, its supported syntax and common field contracts
are checked. Ignored machine-local configuration is intentionally outside the
publishable snapshot.

## Privacy

The core reads optional ignored `.claude/doctor.local.json` with
`{ "privacyTerms": ["private marker"] }`. An existing malformed or empty policy
fails validation. A missing policy produces `privacy.unchecked`, not a privacy pass.
The private addon does not forbid its own company terms.

All Git-listed text and filenames are checked, including historical plans and
JavaScript. There is no historical allowlist. Binary payloads are reported as
unreviewed; their filenames remain checked. Diagnostics omit matched content and
redact supplied terms. Native CLI/test output is not a universal secret scrubber.

This is **not a full secret scanner**. It cannot detect unknown company facts,
credentials of every format, images, Git history, PR bodies or Actions logs.
Do not put private terms in a public workflow or expose secrets to untrusted PR
code to make its indicator green. Public CI can enforce structural checks while
reporting corporate privacy as unchecked.

The dedicated CI job scans full Git history with checksum-verified Gitleaks 8.30.1.
`.gitleaksignore` lists only individually reviewed synthetic detector fixtures by
commit, path, rule and line in this repository's new history. It does not exempt a
file, directory, future commit or company term. Inline `gitleaks:allow` comments
are ignored by the job. The previous repository's history is not imported; its
old fingerprints must not be copied as if they applied to this repository.

Husky can be bypassed with `--no-verify` or `HUSKY=0`, and Git skips missing hook
directories. CI failure does not prevent a merge unless required checks are
configured remotely. No remote repository protection is installed by this patch.
[Husky limitations](https://typicode.github.io/husky/how-to.html)

Removing current content does not remove previously published copies.
History rewriting, cached PR references, logs, credentials and repository visibility
need a separate authorized remediation.
[GitHub sensitive-data removal](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

## What evidence can and cannot establish

The tests use valid/invalid synthetic fixtures, real Git indices, staged/unstaged
divergence, symlink/junction boundaries, and CLI exit codes. No live model is started.

Do not use stars, instruction counts or metadata compliance as a performance score.
[Evaluating AGENTS.md, v2](https://arxiv.org/abs/2602.11988v2) reports no general
task-success improvement and higher average inference cost in its tested settings.
[On the Impact of AGENTS.md, v2](https://arxiv.org/abs/2601.20404v2) reports efficiency
benefits in a different sample. Neither validates Poneglyph, an ideal description
length, or the new validator's effect on delivered software quality.

Acceptance for this version is narrower: detect the specified source defects
before review, reuse one gate, preserve private/public boundaries, and state gaps.
Behavioral experiments belong to the separately reviewed evaluation work.
