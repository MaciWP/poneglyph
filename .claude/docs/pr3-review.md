# PR #3 scoped implementation review

Status: reviewed implementation snapshot used to prepare the independent
`MaciWP/poneglyph` repository. The previous repository is now private and retains
all four open PRs. No old Git ancestry is imported. Machine deployment and public
release remain separate verification gates. The record below describes the
earlier candidate; the [migration boundary](repository-migration.md) supersedes
its abandoned force-push publication procedure.

## Scope and base

[PR #3](https://github.com/MaciWP/claude-code-poneglyph/pull/3) is a critical audit,
not a patch that fixes every observation. Its original inventory belongs to
`ecd56cf37229afddce1e29f40b24b82c2dc8f724`; its follow-up reviews
`802d7953ea6da0f6c8116e8947932b52ea1130ea`. Do not present the old 32-skill inventory
as today's 30-skill core.

This implementation starts from that later main revision in a separate review
checkout. The earlier mixed working tree is preserved outside this candidate.
The PR branch's original audit documents are included, with explicit privacy
redaction. Preserve their reviewed content, not the old Git ancestry. Source
commit links below are historical references in the now-private repository;
they are not commits reachable from this new repository.
The private addon candidate starts from `f89df5b219012db78d0faaa03272cb245261fe65`.
Neither candidate replaces the installed source.

The approved addition is a shared **static** configuration gate and a minimal
private addon. It is not permission to implement the entire audit backlog.
See [the contracts and evidence](config-quality.md).

## Decisions on the audit advice

| Ref | Decision | Implementation or boundary |
|---|---|---|
| D1 | Accept checking real metadata instead of estimating from YAML markers | The new gate parses YAML and measures decoded descriptions. Fixing the separate ranker/budget parsers is not claimed here. |
| D2 | Accept earlier source validation | Pre-commit checks the Git index; CI and doctor reuse the same engine. Negative fixtures verify that unstaged repairs cannot hide staged errors. |
| D3 | Accept public/private separation | Work is optional and contains unique skills/evidence, not a second doctrine. Core defaults do not enable the private plugin. |
| D4 | Accept removing duplicate workspace injection | Work's SessionStart hook and its dedicated tests are removed. Its existing workspace reference preserves the information. |
| D5 | Accept truthful measurements (N01/N02) | Doctor rejects failed/empty native checks and parses a contiguous runner footer instead of test names. The false suite failure was reproduced before correction. |
| D6 | Reject arbitrary quality limits | No 150-character target, keyword quota, question quota, score or mandatory rewrite of every long skill. Documented constraints block; recommendations warn. |
| D7 | Reject claims of host equivalence | Native permissions and effective loading differ. No Claude hooks or slash commands are silently installed into Codex. |
| D8 | Defer behavioral experiments | No agent activation probes, model judges, benchmarks, MCP starts or inference calls in this version. PR #2 remains separate. |
| D9 | Defer lifecycle redesign | State transitions, approvals, build/critic ordering and the proposed dev/flow integration belong in the lifecycle review, associated with PR #4. |
| D10 | Defer unrelated implementation defects | Installer rollback, shell authorization heuristics, eval process contracts, HTML rendering and helper repair need their own scoped changes. Existing earlier edits are not imported wholesale. |
| D11 | Keep privacy failures visible | No historical allowlist. A missing local term policy is explicitly unchecked; a match is blocking. Repository visibility and published history are separate remediation. |
| D12 | Fix the fixtures that prevent Linux CI from running | The previous PR run failed three tests because two test files wrote to a fixed macOS scratch directory. They now use disposable OS temporary directories; assertions and production hooks are unchanged. |

## Privacy relocation and historical audit limits

With user approval, 29 historical documents from the reviewed main revision were
preserved byte-for-byte in private Work memory. Their public paths now retain
generic summaries. Lifecycle identifiers, dates, approval flags and completion
state remain unchanged. Two company-specific path lists in plan 029 state are
omitted publicly with an explicit note; their full values remain in the archive.

The existing PR audit added four more company-bearing files. Those originals
are also preserved privately: 33 originals total, each checked against its source
Git blob. The archive manifest records each path and source commit. It is memory,
not a runnable second checkout or shared doctrine. No public-core command needs
that archive to operate.

The public historical inventory now contains 222 of the original 231 records;
nine private records are explicitly omitted. Skill assessments S02 and S32 retain
generic findings without identifiers. Remaining findings and original result
files are historical, not newly measured successes.

The old `reproduce.ts` depended on a retired private hook and obsolete source
contracts. Its full original is archived; its public entrypoint now returns 2
without executing probes. `verify-coverage.py` also returns 2 for the explicitly
redacted inventory instead of reporting complete coverage or printing private
paths reconstructed from Git history. Current configuration checks and tests
replace neither historical evidence nor the remaining audit backlog.

The Linux failure was observed in [the existing PR run](https://github.com/MaciWP/claude-code-poneglyph/actions/runs/33982918413).
Its fixture repair does not repair or change the production security scanner.

A static pass does not approve the semantic quality of every skill. It certifies
only the named contracts. Existing production helpers and historical claims can
still be wrong even when the configuration parses.

## Current inventory coverage

All 30 core entrypoints participate in the same structural check; none is exempt.
Decoded description lengths are 306-815 characters at this candidate's census.
The five existing Markdown commands and four registered core hook implementations
are included in their applicable checks. Helpers are source-scanned for privacy;
the gate does not execute them.

| Component group | Skills | Action in this candidate |
|---|---|---|
| Shared development | anti-hallucination, dev, drillme, lessons, verify | Keep current workflow. Only lessons' optional-private boundary changes. |
| Feature lifecycle | scope, tech-plan, tdd-design, build, critic, retro | Validate metadata; defer lifecycle changes. |
| Review and diagnostics | diagnostic-patterns, explain-changes, pr-conventional-comments, pr-review, review-patterns, security-audit | Validate metadata/references; do not claim helper bugs are repaired. |
| Research and orchestration | consult, decide, deep-research, orchestrator-protocol, prompt-engineer, skill-advisor, unstuck | Validate structure; do not launch workers or change model policy. |
| Authoring and presentation | frontend-craft, graphify, html-report, meta-harness | Validate structure; graphify's 674-line body warns without an arbitrary rewrite. |

Work retains three unique skills. Shared rules G7/U1 stay in core lessons; Work
holds company-specific evidence and refers to those rules instead of copying them.
Work activation is an explicit per-machine installation step, not a published core
default. It may be available across all projects of that machine's user. This
supersedes the candidate's earlier project-only activation recommendation.

## Deferred proposal: dev with native planning

Recommendation, **not an implemented workflow change**:

1. Keep one `dev` skill with two entry states: planning and approved execution.
2. In native plan mode, apply KNOW and PLAN. Research when uncertainty or risk
   justifies it. Validate evidence and scope, compare meaningful alternatives,
   and stop at the host's approval boundary.
3. After approval, recover the accepted plan and verify that it still matches the
   working tree. Continue BUILD, REVIEW and LEARN without regenerating the plan.
4. If a material assumption fails, return to planning and request a revised
   decision. An approval is not blanket authority for new scope or publishing.
5. Keep `/flow` only where persisted tasks, dependencies, phase evidence and
   multi-session recovery add value. It should apply dev's method, not maintain
   a competing plan or duplicate approval for the same decision.

The host owns mode switching and its approval UI. A skill cannot guarantee that
it loaded or overrule native permissions. No universal cross-host hook is assumed.
Current dev also allows bounded work to proceed after planning; integrating an
explicit native Plan mode must preserve the host's stricter pause.

This direction fits the documented [Codex plan command](https://learn.chatgpt.com/docs/developer-commands?surface=cli),
[Claude plan mode](https://code.claude.com/docs/en/permission-modes), and
[Grok plan mode](https://docs.x.ai/build/features/plan-mode). Grok explicitly warns
that its edit gate does not cover shell writes or a parent's subagents.
These documents support the workflow boundary, not a measured quality gain.

## Candidate verification record before the repository split

Verification on Windows with Bun 1.3.14 (updated after the machine-scope correction):

| Check | Observed result | Limit |
|---|---|---|
| Core suite through doctor and actual Git pre-commit | 479 pass, 0 fail | Local Windows execution; no new remote CI result |
| Core plugin structure and budget | Passed | Structure and measured bytes, not effective model behavior |
| Work source gate | 56 text files, 3 skills, 0 errors, 0 warnings | Static contracts only |
| Work plugin and marketplace manifests | Native validation passed separately | No model or plugin session started |
| Shared Husky pre-commit in Work candidate | Actual Git hook invoked validator and exited 0 | Checks the two staged machine-scope documentation changes and existing source |
| Original core workspace | Same HEAD, 59 status entries, empty staged diff | Earlier mixed changes remain there, outside this candidate |
| Core source and privacy | 433 text files, 30 skills, 0 errors; graphify has one advisory warning | Checks only configured terms, not all possible private facts or credentials |
| Private originals | 33/33 archive files match their source Git blob | Does not erase public history |
| Historical state preservation | 21 frontmatter-bearing documents retain lifecycle fields; plan 029 operational state unchanged | Only private path evidence is removed from public state |
| Historical audit entrypoints | Both return 2 with an explicit not-validated explanation | Deliberately not current-source verification |
| Full doctor sync status | Claude warning; Codex six entries not linked to candidate | Candidates are deliberately not deployed globally |
| Machine activation regression | Base alone stays independent; opt-in and explicit disable survive repeated real settings generation | Disposable Windows profile, not the installed user profile |
| Independent cleaned-history clone | Git integrity passed; 365 commits, 15 refs; no configured-term matches | Seven branch tips match the approved redaction policy; no remote rewrite yet |
| Secret scan | Cleaned history and private Work history pass Gitleaks; a new synthetic secret is rejected | Exact reviewed synthetic history fingerprints only; not a confidentiality proof |
| Original checkouts and host settings | 454 source files and seven backed-up host files unchanged; original HEADs and indices unchanged | Candidate edits are staged separately |

The native plugin CI job now fails on validation errors. Its earlier successful
unauthenticated run met the existing informational-only upgrade trigger. The CLI
is pinned to the locally validated 2.1.263 release; Bun is pinned to 1.3.14. The new
remote run, including Linux and the full-history secret job, remains pending.

The system skill creator's Python quick validator also ran. It needs Python UTF-8
mode on this Windows machine, then rejects existing Claude extension fields
(`disable-model-invocation` and `when_to_use`). Its narrower authoring schema is
not treated as the native cross-host contract. No valid Claude field was removed
merely to satisfy that helper; Codex support for extension semantics is not claimed.
The shared validator accepts the documented Claude types and portable baseline.

Husky is configured only in the two review checkouts. User-wide host configuration
and the original checkouts are unchanged. The Work candidate's local Git hook path
points at the core candidate; moving either checkout requires reviewing that path.

The earlier seven-branch force-push proposal was superseded by the approved
private-history/new-repository split. It was not executed. The old PRs remain
private historical references; this snapshot does not merge or close them.
Other PR functionality stays separate. Machine deployment and remote CI need
their own current evidence before public release.

- Review the actual final diff, including new untracked source files, before
  staging it. The original mixed working tree remains separate.
- Install the reviewed core/Work changes locally only after resolving privacy
  and inspecting existing host/plugin activation. No global installation changed.
- A local green suite is not a green remote run. Required GitHub checks, Work CI
  access and a published/pinned core revision remain remote configuration work.
- Previously public Git history, PR references and Actions logs remain outside
  current-source cleanup. Do not call the repository leak-free.

## Learning captured

Two observed failures justify explicit checks: Bun 1.3.14 accepts an unterminated
TOML table header, and doctor read test names as suite counters. Tests now
exercise rejection and correct summarization rather than matching reassuring text.
Historical privacy exceptions hid current content. The originals now have private
provenance; no historical exception can hide the next leak. Two additional doctor
regressions first failed, then passed: an incomplete final summary cannot reuse an
earlier successful footer, and an entirely skipped suite cannot count as verified.
The Linux CI failure also demonstrates why tests need their own OS temporary
directories, not paths copied from a previous session.
The history audit found a second path for the same Git blob in an old adapter.
Object scanning alone is not enough: check every historical filename and verify
an independent clone after rewriting. Machine activation also needs a persistent
ignored overlay; a one-off CLI setting can disappear on the next shared sync.
