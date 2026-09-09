---
phase: 2.5
status: approved
tdd_policy: forced
approved: 2026-09-08
---
# Test oracle

## US1
- Pre: disposable local inputs and frozen definitions; no model accounts.
- Action: exercise the public functions and real CLI applicable to the HU.
- Assert: Immutable prompts and experiments; invalid references and unsafe paths fail.
- Red: absent implementation or existing behavior violates that acceptance requirement.
- Verify: bun test ./.claude/lab/; retain targeted red/green evidence in the implementation log.

## US2
- Pre: disposable local inputs and frozen definitions; no model accounts.
- Action: exercise the public functions and real CLI applicable to the HU.
- Assert: Sources changing after capture cannot change saved profiles; uncontrolled references fail preflight.
- Red: absent implementation or existing behavior violates that acceptance requirement.
- Verify: bun test ./.claude/lab/; retain targeted red/green evidence in the implementation log.

## US3
- Pre: disposable local inputs and frozen definitions; no model accounts.
- Action: exercise the public functions and real CLI applicable to the HU.
- Assert: Interrupted transitions restore bytes, links and absent paths; conflicts preserve originals.
- Red: absent implementation or existing behavior violates that acceptance requirement.
- Verify: bun test ./.claude/lab/; retain targeted red/green evidence in the implementation log.

## US4
- Pre: disposable local inputs and frozen definitions; no model accounts.
- Action: exercise the public functions and real CLI applicable to the HU.
- Assert: References pass; known mutants and invented check output fail.
- Red: absent implementation or existing behavior violates that acceptance requirement.
- Verify: bun test ./.claude/lab/; retain targeted red/green evidence in the implementation log.

## US5
- Pre: disposable local inputs and frozen definitions; no model accounts.
- Action: exercise the public functions and real CLI applicable to the HU.
- Assert: Atomic idempotent import and an already-correct implementation reject incorrect changes.
- Red: absent implementation or existing behavior violates that acceptance requirement.
- Verify: bun test ./.claude/lab/; retain targeted red/green evidence in the implementation log.

## US6
- Pre: disposable local inputs and frozen definitions; no model accounts.
- Action: exercise the public functions and real CLI applicable to the HU.
- Assert: Drain both streams, enforce limits, isolate attempts and reject invalid terminal output.
- Red: absent implementation or existing behavior violates that acceptance requirement.
- Verify: bun test ./.claude/lab/; retain targeted red/green evidence in the implementation log.

## US7
- Pre: disposable local inputs and frozen definitions; no model accounts.
- Action: exercise the public functions and real CLI applicable to the HU.
- Assert: Reject empty JSON and failed sessions; record configuration evidence.
- Red: absent implementation or existing behavior violates that acceptance requirement.
- Verify: bun test ./.claude/lab/; retain targeted red/green evidence in the implementation log.

## US8
- Pre: disposable local inputs and frozen definitions; no model accounts.
- Action: exercise the public functions and real CLI applicable to the HU.
- Assert: Parse native JSONL, retain model/profile identity and native hook trust.
- Red: absent implementation or existing behavior violates that acceptance requirement.
- Verify: bun test ./.claude/lab/; retain targeted red/green evidence in the implementation log.

## US9
- Pre: disposable local inputs and frozen definitions; no model accounts.
- Action: exercise the public functions and real CLI applicable to the HU.
- Assert: Repeat preserves frozen definitions; comparisons expose confounders and missing attempts.
- Red: absent implementation or existing behavior violates that acceptance requirement.
- Verify: bun test ./.claude/lab/; retain targeted red/green evidence in the implementation log.

## US10
- Pre: disposable local inputs and frozen definitions; no model accounts.
- Action: exercise the public functions and real CLI applicable to the HU.
- Assert: Exercise demo and recovery; verify native host/platform combinations separately.
- Red: absent implementation or existing behavior violates that acceptance requirement.
- Verify: bun test ./.claude/lab/; retain targeted red/green evidence in the implementation log.

US10 additionally requires native swap/load/restore evidence for all three hosts on Windows and macOS. Unexecuted native checks remain not_run.
