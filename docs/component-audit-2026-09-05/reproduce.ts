#!/usr/bin/env bun
// Historical entrypoint retained so existing report links do not break.
// The original probes depended on a retired private hook and old source contracts.
// Its byte-exact original is in private Work memory, with Git provenance.
console.error("Historical probes are archived and are not executable against the current core. No observations were validated. Use bun run check:config and the current regression suite. See .claude/docs/pr3-review.md.");
process.exitCode = 2;
