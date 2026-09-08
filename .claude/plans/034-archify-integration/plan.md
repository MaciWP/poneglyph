# Guided Archify integration

Date: 2026-09-08. The user approved this implementation plan and two separate commits.

## Goal

Use the official Archify package to deliver useful, source-backed technical diagrams
with the original interactive viewer. Keep upstream instructions, schemas, examples,
and reader features in the installed package instead of maintaining copies.

## Approved decisions

| ID | Decision |
|---|---|
| AC1 | Commit the existing repository Codex configuration separately; do not change global or account settings. |
| AC2 | Keep the verified official engine pin and native notification-only update checker. Updates require an explicit request. |
| AC3 | Maintain one shared entrypoint. Resolve its real location, reuse current host adapters, and read the installed upstream contracts. |
| AC4 | Repair keyword discovery through the existing loader contract and a regression using the actual Archify skill. |
| AC5 | Rework the three original diagrams with useful guided chapters, source-derived facts, native motion, and supported exports. |
| AC6 | Preserve Mermaid for simple inline diagrams, html-report for reports, and graphify for persistent knowledge graphs. |
| AC7 | Require upstream showcase acceptance, actual screenshot inspection, reader interactions, and cross-project reuse checks. |
| AC8 | Run the repository gates and inspect the two commits before one normal push to the current upstream. |

The maintenance target is the integration with upstream Archify. Background package
updates and regeneration after target-source changes are outside this feature.

## Implementation

1. Persist the five existing Codex defaults in their own commit.
2. Correct the Archify keyword marker and reuse the native loader test file.
3. Keep installation/version details in the integration reference. Read all authoring,
   delivery, language, and viewer contracts from the installed release.
4. Author the existing architecture, workflow, and sequence examples as demonstrations
   of actual Poneglyph behavior, not copies of upstream domain content.
5. Validate, render, inspect, and exercise the artifacts. Record current evidence
   separately from the earlier implementation receipts.
6. Commit Archify, inspect the separate scopes, and push both commits normally.
   A rejected push stops publication; it does not authorize force or protection changes.

| Example | Question | Native capabilities |
|---|---|---|
| Architecture | How does one maintained source reach Claude, Codex, and Grok? | Host boundaries, three chapters, directed routes, source badges, signal-flow presentation. |
| Workflow | How does the dev loop advance, wait for approval, and recover? | Five stages, approval branch, implementation/premise/context returns, three chapters, signal-flow presentation. |
| Sequence | How is a missing Codex skill link discovered, installed, and inspected? | Discovery/preflight/install segments, activations, returns, three participant chapters, classic presentation. |

## Assumptions and risk controls

- The native engine and browser are already installed. Reuse them without upgrades.
- Diagram facts are a snapshot of the inspected public source revision. They do not
  claim future freshness or equal model activation across hosts.
- Native diagram types have different capabilities. Architecture supports verified
  repository references; sequence chapters focus participants, not message ranges.
- Automated acceptance does not establish visual quality. Inspect the generated
  screenshots and selected reader states.
- Preserve unrelated changes and installed settings. Engine and browser receipts
  stay in ignored artifact locations.

## Dev loop

| Stage | Result |
|---|---|
| KNOW | Inspected pinned contracts, official examples, source adapters, existing artifacts, and the pending diff. |
| PLAN | Approved two commits, upstream references, pinned updates with notices, and three useful original examples. |
| BUILD | Added the loader regression, repaired discovery, reduced duplicated upstream rules, and reworked the examples. |
| REVIEW | Current checks and residual limitations are recorded in validation.md. |
| LEARN | Source evidence and guided chapters have type-specific limits; native validation and visual review remain separate. |
