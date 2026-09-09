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
Edit the JSON, never the generated HTML. From the repository root:

```powershell
$engine = (Resolve-Path '.cache/archify/v2.16.0/archify/bin/archify.mjs').Path
node "$engine" deliver architecture "docs/diagrams/poneglyph.architecture.json" "docs/diagrams/poneglyph.html" --repo-root "." --quality showcase --json
node "$engine" deliver workflow "docs/diagrams/flow.workflow.json" "docs/diagrams/flow.html" --quality showcase --json
node "$engine" deliver workflow "docs/diagrams/dev.workflow.json" "docs/diagrams/dev.html" --quality showcase --json
node "$engine" deliver workflow "docs/diagrams/lab.workflow.json" "docs/diagrams/lab.html" --quality showcase --json
```

Stop on any nonzero exit. A failed delivery preserves the last-good HTML; do not
attribute it to the revised JSON. Run `visual-check` only after successful delivery.
For QA, use a byte-identical HTML copy under the ignored `.cache/poneglyph-diagrams/`
directory so browser receipts and screenshots stay out of the public guide folder.

Open each final HTML in its light theme. Use **Export → PNG** to replace its
README image. The PNG is the complete canonical diagram; benefits and limits are
in the HTML cards and the README comparison table. The generated viewer retains
the upstream [MIT license](LICENSE.archify.txt). Viewing needs only a browser.

## Observed validation

The original three deliveries passed 9/9 showcase artifact checks with zero composition
errors and warnings. Each passed containment at 1440×900, 1600×1000, 1920×1080,
and 2048×1320. Both themes were inspected. One visual revision improved overview
text size and the Dev layout; the engine and generated HTML were not patched.

Real Edge execution with networking disabled exercised all nine chapters, search,
focus and dismissal, themes, presentation entry/exit, and native PNG/SVG exports.
Exports were initiated with a chapter active. The SVGs retained all 9/10/6 nodes
respectively, and the PNGs decoded. Delivered HTML hashes remained unchanged.
The three PNG previews were visually inspected at 900px in a local Markdown
render. They contain only the authored diagrams; fine detail is available by
opening the full image or HTML. The README's ten local guide links resolve.

The ignored cache contains `*-deliver.json`, `*.visual-check.json`, screenshot
sidecars, and `browser.json`. Automated receipts still say `visualReview: pending`;
the inspection described here is separate evidence. Validation covers these
diagrams on Windows/Edge, not fresh-model activation or all browsers.

When the working method changes, re-read the source, update the affected JSON,
regenerate the HTML and PNG together, and replace this snapshot record. A correct
diagram of an earlier revision is not evidence of the current implementation.

## Laboratory source snapshot

Reviewed on 2026-09-09 from the laboratory publication candidate. This snapshot
is separate from the published architecture and Flow revisions above. The diagram
is a workflow with eight nodes and four guided chapters. Its authored text is
Spanish; Archify does not provide a Spanish viewer locale, so the unchanged
viewer controls remain English.

The [CLI](../../.claude/lab/cli.ts) and [version store](../../.claude/lab/store.ts)
establish preparation, freezing, explicit execution, and immutable history.
[Profiles](../../.claude/lab/profiles.ts) distinguish the captured personal layer
from common native settings. The [runner](../../.claude/lab/runner.ts) calibrates
the verifier, starts fresh attempts, records failures, and attempts restoration
in `finally`. The [transaction](../../.claude/lab/transaction.ts) retains original
paths and a recovery journal. The [oracle](../../.claude/lab/oracle.ts) checks the
submitted code and observed database state. The [report](../../.claude/lab/report.ts)
rejects incompatible comparisons and preserves unknown measurements.

Two distinctions must survive future diagram revisions: `current` is the saved
profile, while restoration targets the configuration present at execution start;
changing several factors permits exploration but does not isolate one cause.
Credential and managed-policy handling stays outside the behavioral swap. A hard
termination can leave recovery pending; restoration is not guaranteed without
running recovery. The ordinary protection-to-installation and installation-to-agent
edges are unlabeled because their endpoints already state the action.

These SHA-256 fingerprints use UTF-8 text normalized to LF. They identify the
inspected source independently of future commits.

| Source in `.claude/lab/` | SHA-256 |
|---|---|
| `cli.ts` | `d593386083fe457f2b6f46dba10cb531de69245e7e185952cb918fe618ffb49e` |
| `runner.ts` | `afa89b504b31c61f2bab2c2a12146ec2a7c1568e42a281001e7d2bc44d4294fa` |
| `profiles.ts` | `c41f6c52f391a4c1820649f0e443626c05ac4d36890f502c8109246afc364dfd` |
| `oracle.ts` | `291d98c8897f9684f7f2a8b25c84417f1745586d0f780097a1e068d144acd740` |
| `catalog.ts` | `bee8af9051125aff1ac6ff10feef859710bad349478bc6b1ea1ba38bb03c3ff9` |
| `worker.ts` | `bcf13d5cfb209ff04c3414b5f8558414a23eaa543bfcbb7c320113d645c6edc8` |
| `process.ts` | `2f8517336883e170aa3fcec0ec3ca4c8e5dbdd033f85397348c91a434b56a14e` |
| `report.ts` | `9f5549ac6ef98a6cce63b244a04a65d2ab9a2be16e7fc00369ab58b5a69cf96a` |
| `store.ts` | `6045697bf034315cf4c2e16375cd55d64c4ca2f609ae3e1179772f178b4b63af` |
| `transaction.ts` | `b8ffa555c2cb8542bf2c2ac3ec57ffa5ac87783e07b1a2fb12119a19bca9a077` |

The [native acceptance record](../../.claude/plans/036-reproducible-lab/native-validation.json)
remains `pending-native-acceptance`: real native swaps, effective loading, and
model trials have not been accepted on Windows or macOS. This diagram explains
the implemented mechanism; rendering it does not validate those capabilities or
establish statistical superiority for a profile.

The final laboratory delivery passed 9/9 showcase checks, with zero composition
errors or warnings. Containment passed at 1440×900, 1600×1000, 1920×1080, and
2048×1320. The final light and dark screenshots were inspected. One initial width
repair addressed desktop readability, followed by one wording revision. Neither
the engine nor the generated HTML was patched.

Offline Edge execution exercised all four chapters, search, focus and dismissal,
themes, presentation entry/exit, and native PNG/SVG exports. Exporting while a
chapter was active retained all eight nodes and labels in the SVG. The PNG
decoded at 4860×2592 and was inspected at a representative 900px README width.
Overview labels remain small; open the full image or use the interactive guide
for detail. No browser errors were observed, and the delivered HTML hash stayed
unchanged. Visual review passed with one correction round; automated visual
receipts retain their separate `visualReview: pending` field.

| Delivered file | SHA-256 |
|---|---|
| `lab.workflow.json` | `3b2a0c935f68f37266ca4bced47092686780fe51c4eff33132a90b1f4d39a472` |
| `lab.html` | `98ce17e8f29e049606b0499bc78aecdfa6457f84f7a06ecfbbca94d2d5032697` |
| `lab.png` | `1bcdeeeb8084311ee563b5506abe521132611a942dd9386515bbf4f4e0bebaa9` |

The ignored `.cache/poneglyph-diagrams/` folder retains `lab-validate.json`,
`lab-deliver.json`, `lab.visual-check.json`, screenshots, `lab-browser.json`, and
`lab-docs.json`. Reproduce the guide with the workflow command above, then repeat
visual review and export. This evidence covers the diagram in Windows/Edge;
the laboratory's native acceptance remains separate.

The 2026-09-09 publication review adds per-action SQLite row-change observations
to oracle version 2 and fixes cancellation during child registration. The diagram's
workflow and delivered bytes remain unchanged. Its validation, offline interaction,
native exports, and README preview were rechecked against that specification.
