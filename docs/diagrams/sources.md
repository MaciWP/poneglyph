# Visual guide sources and reproduction

The guides explain the working method at a snapshot. They do not monitor the
repository or prove that an agent follows every instruction. Benefits describe
design goals, not measured improvements in success rate, speed, or token cost.

## Checked source

Reviewed on 2026-09-08. Base revision:
`baf1fb8e5ea8caa02b9b5e1c530f34cae1ba42c7`.

The architecture's native source links are pinned to that public revision.
Flow reflects the coherence revision in commit
[2dec92f](https://github.com/MaciWP/poneglyph/commit/2dec92f1526544f77285bba947e6d2104d89bf59),
published with these guides. Its six phase skills and verified-closure contract
are described by the sources below.

| Guide | Inspected source | Meaning retained |
|---|---|---|
| Poneglyph | [Doctrine](../../CLAUDE.md), [host adapters](../../.claude/docs/harness-adapters.md), [routing](../../.claude/rules/skill-routing.md), [doctor](../../.claude/scripts/doctor.ts), [lessons](../../.claude/skills/lessons/SKILL.md) | Shared guidance, native execution, optional skill hints, evidence, and limits |
| Flow | [Command](../../.claude/commands/flow.md), [state helper](../../.claude/scripts/flow-state.ts), [verification contract](../../.claude/docs/flow-contract.md), [contract implementation](../../.claude/scripts/lib/flow-contract.ts) | Six phase skills, two human decisions, dependent tasks, review repair, state, and verified closure |
| Dev | [Skill](../../.claude/skills/dev/SKILL.md), [verification](../../.claude/skills/verify/SKILL.md) | Five stages, proportional depth, approval by impact, real checks, and return to the failed premise |

Flow source fingerprints use SHA-256 over UTF-8 text with LF line endings. They
identify the inspected Flow version independently of the earlier architecture snapshot.

| Source | SHA-256 |
|---|---|
| `flow.md` | `333763e30af245de28091519afce1ad67b8127fd81a1db1a24cd6d0a4fc73a6e` |
| `flow-contract.md` | `0d0718fe7393ed3b6a13d27c741ce669338c91974de44eae68be008f0c7efb2d` |
| `flow-state.ts` | `2aa21c586da148c0226a0602e4672df7da7736fb6404482ddacc1367e996c91b` |
| `flow-contract.ts` | `7fb992f31cd87d87e0aa96801a6e6ca49eef541221f431ced40ed2bceeb11f10` |

## Regenerate a guide

Use the unchanged Archify **2.16.0** engine from the
[installation recipe](../../.claude/skills/archify/references/integration.md).
The repository tracks editable JSON and PNG previews. Generate HTML on demand
under the ignored cache; generated HTML is not a tracked source. From the repository root:

```powershell
$engine = (Resolve-Path '.cache/archify/v2.16.0/archify/bin/archify.mjs').Path
node "$engine" deliver architecture "docs/diagrams/poneglyph.architecture.json" ".cache/poneglyph-diagrams/poneglyph.html" --repo-root "." --quality showcase --json
node "$engine" deliver workflow "docs/diagrams/flow.workflow.json" ".cache/poneglyph-diagrams/flow.html" --quality showcase --json
node "$engine" deliver workflow "docs/diagrams/dev.workflow.json" ".cache/poneglyph-diagrams/dev.html" --quality showcase --json
```

Stop on any nonzero exit. A failed delivery preserves the last-good HTML; do not
attribute it to the revised JSON. Run `visual-check` only after successful delivery.
Keep browser receipts and screenshots in the same ignored cache directory.

Open each final HTML in its light theme. Use **Export → PNG** to replace its
README image. The PNG is the complete canonical diagram; benefits and limits are
in the HTML cards and the README comparison table. The generated viewer retains
the upstream [MIT license](LICENSE.archify.txt). Viewing needs only a browser.

## Historical validation — 2026-09-08

All three deliveries passed 9/9 showcase artifact checks with zero composition
errors and warnings. Each passed containment at 1440×900, 1600×1000, 1920×1080,
and 2048×1320. Both themes were inspected. One visual revision improved overview
text size and the Dev layout; the engine and generated HTML were not patched.

Real Edge execution with networking disabled exercised all nine chapters, search,
focus and dismissal, themes, presentation entry/exit, and native PNG/SVG exports.
Exports were initiated with a chapter active. The SVGs retained all 9/10/6 nodes
respectively, and the PNGs decoded. Delivered HTML hashes remained unchanged.
The three PNG previews were visually inspected at 900px in a local Markdown
render. They contain only the authored diagrams; fine detail is available by
opening the full image or HTML. The local guide links resolved at that snapshot. Regeneration instructions replace tracked HTML links on 2026-09-13.

The ignored cache contains `*-deliver.json`, `*.visual-check.json`, screenshot
sidecars, and `browser.json`. Automated receipts still say `visualReview: pending`;
the inspection described here is separate evidence. Validation covers these
diagrams on Windows/Edge, not fresh-model activation or all browsers.

When the working method changes, re-read the source, update the affected JSON,
regenerate the HTML and PNG together, and replace this snapshot record. A correct
diagram of an earlier revision is not evidence of the current implementation.
