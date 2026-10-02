---
parent: pr-review
---

# Follow-up round (the PR already has a review of yours)

Steps 0-9 still apply. This file changes what each round looks at, not the verdict rule
(that stays in `01-criteria-core.md`).

1. **Trace the previous comments.** One row per comment of the last round:

   | Comment | Commit that answers it | Status |
   |---|---|---|
   | short subject | `<sha>` or "none" | resuelto / parcial / no (with the evidence) |

   A reply in the thread is a claim; the code is the evidence.
2. **Read the delta, check the whole head.** Review `git diff <reviewed_sha>..<head>` for new
   findings, but run the project checks on the full head: a fix can break code it did not touch.
3. **Never move the checkout to measure** (`lessons-learned` G21). Export the head instead:
   `git archive <sha> | tar -x -C <scratch>`. Submodules are not in the archive; export each one
   at the SHA the head pins (`git ls-tree <sha> <submodule>`) the same way.
4. **New tests must fail before the fix.** Run the author's new tests against the previously
   reviewed head (another export). A test that passes there does not test the fix (`lessons-learned` G10).
5. **The bar rises.** Publish only findings that still change the merge: unresolved blockers and
   new blocking problems. Nitpicks and new preferences stay in the chat.
6. **Multi-repo PRs.** A pinned submodule SHA must be reachable from the other repo's base
   branch (`git -C <submodule> branch -r --contains <sha>`); if it is not, state the merge order
   (dependency PR first, repoint the pin, then this PR) in the report.

The report adds the trace table from point 1 before the new findings.
