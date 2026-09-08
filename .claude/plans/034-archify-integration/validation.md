# Archify validation record

Date: 2026-09-08. This record covers the revised guided examples.
Repository gates: passed. The final doctor ran 494 tests with no failures,
validated the plugin and host installation status, and passed the budget check.
The existing graphify length advisory and deferred native-session evidence remain.
The modified-file secret heuristic and `git diff --check` also passed.

## Source and reference material

The diagrams use public Poneglyph revision
`b3cd4ca347b47f866a95e65c4177474c5d77a3ab`. The adapter sources inspected for this
implementation match that revision. The architecture's ten native source references
are verified with `--repo-root` and open revision-pinned GitHub links.

| Diagram facts | Inspected source |
|---|---|
| Shared doctrine, skills and host boundaries | [Harness adapters](https://github.com/MaciWP/poneglyph/blob/b3cd4ca347b47f866a95e65c4177474c5d77a3ab/.claude/docs/harness-adapters.md) and [CLAUDE.md](https://github.com/MaciWP/poneglyph/blob/b3cd4ca347b47f866a95e65c4177474c5d77a3ab/CLAUDE.md) |
| Claude directory distribution | [sync-claude.ts](https://github.com/MaciWP/poneglyph/blob/b3cd4ca347b47f866a95e65c4177474c5d77a3ab/.claude/commands/sync-claude.ts#L14-L25) |
| Skill discovery, preflight, link installation and status | [sync-codex.ts](https://github.com/MaciWP/poneglyph/blob/b3cd4ca347b47f866a95e65c4177474c5d77a3ab/.claude/scripts/sync-codex.ts) |
| Claude compatibility and Grok native additions | [sync-grok.ts](https://github.com/MaciWP/poneglyph/blob/b3cd4ca347b47f866a95e65c4177474c5d77a3ab/.claude/scripts/sync-grok.ts) |
| Five stages, high-impact approval and return-to-cause rules | [dev skill](https://github.com/MaciWP/poneglyph/blob/b3cd4ca347b47f866a95e65c4177474c5d77a3ab/.claude/skills/dev/SKILL.md) |

Visual and interaction references supplied by the user:
[cache-miss sequence](https://tt-a1i.github.io/archify/gallery/artifacts/cache-miss.sequence.html?theme=dark&present=1#route=web~db)
and [MCO dispatch architecture](https://tt-a1i.github.io/archify/cases/mco-runtime.architecture.html?theme=dark&present=1#view=dispatch-path).
Both were opened and inspected during review. The installed release's
`examples/cache-miss-request.sequence.json` and `examples/agent-tool-call.workflow.json`
supply supported field shapes and interaction patterns. They do not supply Poneglyph facts.

## Current acceptance

| Scenario | Observed result | Evidence |
|---|---|---|
| Native keyword loading | The new regression failed with Archify absent, then passed after adding the existing loader's marker. No model or prompt activation probe. | `hooks/__tests__/skill-activation.test.ts` |
| Three original diagrams | All deliver with 9/9 artifact checks, zero composition errors, and zero warnings. | `implementation/*-deliver.json` |
| Repository evidence | Architecture verifies ten references at the declared public revision. The Grok passport exposes both incoming relationships and its pinned source links. | Architecture receipt and actual browser interaction |
| Guided reading | All three chapters open in each diagram. Playback starts and pauses; presentation opens and closes. | `implementation/browser.json` |
| Search, focus and routes | Grok search returns two of seven nodes. Its passport shows two incoming relationships. The source-to-Codex route has three nodes and two directed hops; step navigation works. | Actual Edge interaction |
| Canonical exports | SVG exports parse as XML and retain 7/6/4 nodes respectively, with no focus/finder/route overlays. PNG exports decode successfully. Exports were initiated with a chapter selected. | `implementation/browser.json` and exported files |
| Desktop containment | All three originals pass 1440x900, 1600x1000, 1920x1080, and 2048x1320. | `examples/*.visual-check.json` |
| Visual inspection | Small light and large dark screenshots inspected for all originals; presentation screenshots inspected separately. Spanish text was corrected after visual inspection caught encoding damage. | Generated PNGs |
| External project and revision | A directory with spaces and an accented character resolves the engine through the installed link. Reproduction matches; a title revision changes HTML. Invalid delivery exits 1 and preserves the last-good HTML. | `implementation/external.json` |
| Theme and camera | Theme changes preserve the selected preset. A selected sequence participant remains inside the viewport after the native camera settles. | Actual Edge interaction and presentation capture |
| Offline use and engine integrity | All three HTML files load and navigate chapters with networking disabled. All 76 engine files still match the pinned archive. | `implementation/browser.json` and byte comparison |
| Repository gates | Doctor exits 0: 494 tests, plugin validation, three host status checks and budget. Modified-file secret check and diff whitespace check pass. | `implementation/doctor.md` and native command output |
| Update awareness | The unchanged official checker returned `silent/current`. | Native checker output |

Paths beginning with `implementation/` resolve under the existing ignored
`.cache/archify-validation/` directory. HTML files remain beside their editable JSON.
Automatic receipts retain upstream `visualReview: "pending"`; the inspection above
is separate human-facing review evidence.

## Diagrams and reproduction

| Type | Editable source | Presentation |
|---|---|---|
| Architecture | [poneglyph.architecture.json](examples/poneglyph.architecture.json) | Signal Flow, three host chapters, verified source badges |
| Workflow | [dev.workflow.json](examples/dev.workflow.json) | Signal Flow, approval and recovery chapters |
| Sequence | [sync-codex.sequence.json](examples/sync-codex.sequence.json) | Classic, timeline segments and participant chapters |

Resolve the pinned engine through the skill's integration reference. Use the
installed delivery contract and the original CLI. Architecture additionally needs
`--repo-root <Poneglyph root>`. Run visual checks only after successful delivery.

## Historical evidence and scope

The 2026-09-07 record's 493 tests, five upstream-type deliveries, and original
interaction receipts remain historical evidence in the ignored validation cache.
The original JSON/HTML pairs have been superseded by the guided examples above.
Old receipts must not be attributed to the revised source.

The adapter is already in the current core; there is no pending five-skill-list
dependency or unmerged adapter prerequisite. The earlier checkout/ownership claims
are superseded by this record.

Repository Codex defaults are isolated in commit `7a3a75d`. Global/account model
settings, context metadata, and their private receipts are outside the Archify
change. This feature does not assert effective model changes or optimize quota.

## Limitations and learning

- Runtime/browser evidence is Windows and Edge. macOS/Linux installation, full
  accessibility conformance, and fresh-model activation remain unverified.
- Authored Spanish content keeps the pinned viewer's English controls. Read the
  installed language contract when changing languages or releases.
- Architecture references verify a snapshot, not continuous source freshness.
  Workflow and sequence reject native repository evidence; their sources are above.
- Sequence chapters select participants. Timeline segments express chronological
  phases; a chapter does not filter individual calls. Story cameras may zoom/pan,
  while canonical exports and the overview preserve the whole diagram.
- Fresh clones need the documented engine installation. The cache is not versioned.
- Keep the upstream renderer unchanged. Its workflow main path cannot move backward
  in column order; sequence messages need the documented spacing and timeline bounds.
- Use explicit UTF-8 for source reads and writes. A passing geometry receipt did not
  detect damaged Spanish text; screenshot inspection did.
