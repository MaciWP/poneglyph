# Existence checks — proving a file, symbol or endpoint is really there

Read this when a claim depends on something existing: a file, a function, an export,
a route. The always-loaded rule already says what to do (verify before asserting, and
tag with `[Seguro]` / `[Probable]` / `[Suposición]` what you did not verify). This
reference holds the part that is not obvious: how the tools lie to you.

Provenance: kept from the retired `anti-hallucination` skill. Its invented confidence
percentages were dropped — a model does not compute a calibrated confidence, and
`docs/config-quality.md` AC19 forbids promoting a number without evidence.

## What the tools do NOT prove

| Trap | Why it happens | What to do instead |
|---|---|---|
| `Glob` misses a file you just wrote | Filesystem events are not always flushed when the next tool call runs | Read the exact path you wrote; do not conclude "it does not exist" |
| `Read` on a missing file returns an error, not empty content | The tool returns an error object, not an empty string | Handle the error; empty is not the same as absent |
| `Grep` hits comments, strings and docs | Grep is textual and has no semantic model | Read each hit; a mention inside a comment is not a usage |
| An `import` proves nothing about the export | The importing file can be wrong, stale, or itself hallucinated | Grep the export in the source module |
| A passing suite proves only what it asserts | Coverage is not the same as behaviour | Name which test covers the claim, or say the claim is untested |

## Escalation when a path does not resolve

Go down the ladder; never jump to a guess.

1. Exact match: `Glob` the exact path.
2. Wildcard: `Glob` with `**/*name*`.
3. Fuzzy: `Grep` the filename stem.
4. Ask. Two or more candidates at stage 2, or nothing at stage 3, is a question for the
   user, not an assumption.

## Words that force a check

When the request contains `delete`, `drop`, `remove`, `production`, `migration`,
`deploy`, `secret`, `credential` or `rollback`, verify the target exists and is the one
meant, whatever your confidence. These pair with the destructive-operations rule in the
always-loaded doctrine.
