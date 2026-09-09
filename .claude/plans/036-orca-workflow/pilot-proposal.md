# Pilot team — approved publication validation

Use the existing independent pilot copy and its shared worktree. The 2026-09-09
publication plan authorizes the roster below and a complete validation before PR
publication. Keep fixture changes uncommitted. Do not run global sync/setup
mutations or modify the original project from a worker. Inspect setup before launch.

## Roster

| Session | Provider/model | Role | Resources |
|---|---|---|---|
| A | Claude `sonnet`, medium effort | Implement normalizer; initially own shared exports | `.claude/pilot/orca-workflow/normalize.ts`, `index.ts` |
| B | Codex `gpt-5.6-luna`, medium effort | Implement validator; request export-file transfer | `.claude/pilot/orca-workflow/validate.ts`; `index.ts` only after grant |
| R | Fresh Claude `sonnet`, medium effort | Review the stable assembled result | Read-only pilot fixture and evidence |

Three model sessions, at most two concurrent. Permit reuse of A/B for one in-scope
correction each, without another process launch. Cost class: low to medium; actual
token consumption is measured when available. Models were discovered from the
installed CLI help and Codex model cache. Grok is outside this launch request:
`grok models` reports unauthenticated, despite listing grok-4.6 and grok-4.5.

## Concrete tasks and oracle

The coordinator prepares authoritative Bun tests under `.claude/pilot/orca-workflow/`
after worktree approval and before releasing the workers' startup hold.

- A exports `normalizeLabel(value: string): string`: trim, lowercase and replace
  each internal whitespace run with one hyphen. Cases: `"  Hello World  "` →
  `"hello-world"`, `"A\t B"` → `"a-b"`, whitespace-only → empty string.
- B exports `isValidLabel(value: string): boolean`: accept 1-40 lowercase ASCII
  letters/digits with single internal hyphens. Reject leading/trailing/repeated
  hyphens, uppercase, spaces and empty values. Cases include `"abc-12"`, `"-a"`,
  `"a--b"` and 40/41-character inputs.
- A initially owns `index.ts`. B asks A about the export contract, informs the
  coordinator, then requests the reservation. B adds its export only after A
  acknowledges a stable handoff and the coordinator records the transfer.
- The coordinator holds the assembled smoke task until A and B are accepted.
  Smoke imports both functions from index.ts and validates a normalized label.
- R checks the task criteria, grants, changed files and actual test evidence after
  writer handoff. Required command: `bun test .claude/pilot/orca-workflow/`.

Apply the skill's pilot scenarios to this fixture, including a real failed or
not-run check, timed-out ask/resume, unacknowledged Delivery replay and coordinator
pause/resume. Preserve failed evidence; never alter the oracle to obtain a pass.
No commits, publication, nested agents or worktree deletion are included.
