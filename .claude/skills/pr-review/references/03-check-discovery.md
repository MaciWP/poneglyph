---
parent: pr-review
---

# Check-command discovery (generalist)

Same convention the `changes-verify` skill uses — the project declares its truth; discover it,
don't guess it. Order:

1. **Project CLAUDE.md** — §Commands / §Verification / §Testing sections (e.g. a Vite repo:
   `tsc && vitest`; a Django repo: `pytest`; poneglyph: `bun test ./.claude/`).
2. **`.claude/rules/test-policy.md`** in the repo — often names the verification command.
3. **Conventional fallbacks by stack signal** (only when 1-2 yield nothing): `package.json`
   scripts (`test`, `check-types`, `lint`) · `noxfile.py` / `Makefile` targets · `pytest.ini`/
   `pyproject.toml [tool.pytest]` → `pytest` · `Cargo.toml` → `cargo test`.
4. **Nothing found** → ask the user for the check command; running an invented one wastes a
   cycle and a wrong one green-lights garbage.

Rules:
- Run type checks and linters too when the stack has them (a review that only runs tests
  under-reports).
- Respect the shared-repo etiquette: in work repos, do NOT launch heavy full suites
  unprompted if the project docs warn about collisions — prefer the scoped test command for
  the touched area, and say which scope ran.
- Report the exact command(s) + exit status in the review; a check that could not run is
  declared ("checks no ejecutados: <razón>") and the Tests criterion is evaluated as ⚠, not ✓.
