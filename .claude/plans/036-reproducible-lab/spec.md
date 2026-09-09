---
id: 036-reproducible-lab
created: 2026-09-08
mode: full
phase: 1
status: approved
approved: 2026-09-08
---
# Reproducible Poneglyph laboratory

## Problem
Changes to Poneglyph cannot be compared reliably without controlled configuration, repeatable tasks, independent checks and retained evidence.

## Approved outcomes
- An on-demand, versioned laboratory, not a continuously running benchmark.
- Frozen prompts, scenarios, current/base/candidate profiles and immutable experiments.
- Controlled native configuration replacement with verified recovery and no credential export.
- Autonomous coding trials in disposable projects, assessed by independent executable checks.
- Comparable historical quality, performance, elapsed time and available consumption.
- Claude Code, Grok and Codex adapters; Windows and macOS validation tracked independently.
- Humans validate the catalog and samples, rather than approve every generated solution.

## Acceptance criteria
- AC1: Changing a stored prompt/profile creates a new version and preserves previous experiment definitions.
- AC2: Each trial starts from the frozen scenario and profile without memory or filesystem state from a previous trial.
- AC3: Normal completion, cancellation and interrupted swaps restore original configuration bytes, links and absence; conflicts never overwrite originals.
- AC4: Reference solutions pass and known incorrect implementations fail, including forged verifier output.
- AC5: Five scenarios cover ownership, creation validation, query counts, interrupted idempotent import and conditional no-op improvement.
- AC6: Process errors, timeouts, malformed output and missing telemetry are explicit; no empty result counts as success.
- AC7: Comparison names the varied dimension, reports confounders and includes failed attempts without invented cost or statistical superiority.
- AC8: Native compatibility is claimed only for host/platform combinations with executed evidence.

## Boundaries
Use a dedicated controlled project first. Real-repository and ordinary-session ingestion are future work.
No automatic model runs, configuration changes during implementation, automatic promotion, or global shipping.
Native execution is not an adversarial OS sandbox. Preserve mandatory policy and native hook trust.
Implement maximum attempts and time limits per experiment; no fixed live budget was authorized.

## Decisions
The user approved scope in the scope_gate_approval response and authorized this design with "Implement the plan."
The current active 035 lifecycle is unrelated and will not be altered.
Native acceptance is a required US10 check; it is not implied by deterministic CI.

## Research and reuse
- Historical PR #2: 01e1ab55d37d52dbba08c74908040522093ecd87, 24 offline tests passed on Windows before adaptation.
- Historical PR #1: d0882412f26be984d720da2b5020181f8ed2d766, transport validity tests.
- Baseline main: 1ca2c86ea0d6cdf5f6548548512f550bde7a877e; doctor --ci: 546 tests passed.
- Verified defects: invented ten-check stdout satisfies the old oracle gate; Grok telemetry accepts {}.
- Native documentation: https://learn.chatgpt.com/docs/non-interactive-mode ; https://docs.x.ai/build/cli/headless-scripting ; https://code.claude.com/docs/en/claude-directory
- Experimental design: https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm

## Open questions
No blocking implementation questions. Live model selection, maximum live budget, native hook trust and macOS access are runtime prerequisites.
