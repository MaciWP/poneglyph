# Independent repository boundary

The owner approved this boundary on 2026-09-07:

| Repository | Role | Visibility during preparation |
|---|---|---|
| `MaciWP/poneglyph` | Independent core from reviewed source and accepted adapter changes | Private until release gates pass |
| `MaciWP/poneglyph-prepublic-20260907` | Previous four-commit core retained for recovery | Private; never publish its history |
| `MaciWP/claude-code-poneglyph` | Historical reference with the four original PRs | Private; do not make it public again |
| `MaciWP/poneglyph-work` | Optional unique company skills and memory | Private |

The new core is an independent repository, not a fork or a history rewrite. Its
initial source comes from an explicit reviewed source list, not an unfiltered
directory copy. Previously accepted adapter changes are included. Concurrent
feature work remains separate. The export excludes old Git objects, ignored settings, credentials, local
transcripts and the private Work checkout. Source export preserves executable
file modes. The old source checkouts and protected backups remain unchanged.

Historical audit documents may link to commits or PRs in the private reference
repository. Those links need owner access. Do not replace them with invented
new-repository commit links or present historical measurements as current tests.
The existing [PR #3 review](pr3-review.md) records accepted and deferred advice.

The pre-publication restart replaces the previous four-commit core because a
private lessons blob remained in those commits. The private addon preserves the
original bytes and provenance. The new history contains a clean source import
and exact synthetic-fixture fingerprints tied to that import. No earlier commits
are imported. Reusing the canonical repository name breaks its old redirects;
links to the previous core must name the private pre-publication repository.

## Publishing and later changes

- Never merge, fetch-and-merge, or mirror the old history into this repository.
- Port later PR proposals individually as reviewed source changes. Keep the
  workflow redesign and behavioral experiments outside this initial snapshot.
- Scan the new history and a fresh clone before publishing. Configure required
  checks so a failing CI result cannot be mistaken for merge readiness.
- A different GitHub repository identity requires its own CI and permissions;
  the old repository's settings are not inherited.
- Do not publish the new core merely because source tests pass. Install the
  reviewed adapters, preserve existing machine settings, and verify Windows first.

## Privacy limits and recovery

Making the old repository private withdraws its normal anonymous access; it is
not physical deletion from GitHub storage or deletion of third-party copies.
Verify representative old repository, commit, PR, raw-file and Actions URLs
without credentials. GitHub Support contact and remote history deletion are not
part of this approved migration. No old PR is deleted or merged by this operation.

A pre-publication review found private review identifiers inside otherwise generic
lessons after the configured company-name scan passed. Keep useful shared rules,
but retain their private identifiers and detailed evidence outside the core. Review
the content as well as configured terms, then repeat checks across reachable
history, historical filenames and Actions logs. A corrected source snapshot does
not make an earlier Git blob suitable for public release.

The historical repository is not a second installation. Keep shared doctrine and
validators in the new core. Work remains an optional per-machine addon with no
duplicated `CLAUDE.md`, `AGENTS.md`, agents, hooks or shared tests. Inspect installed
plugin caches before activation; an old cache can retain a hook removed in source.

Preserving a Git index does not guarantee byte-identical archive files on Windows:
`core.autocrlf` can change their working copies. Work marks its provenance archive
as `-text` in `.gitattributes`. Verify each archived file against its recorded Git
blob in the index, the working copy, and the installed cache. A same-version local
plugin update can report "up to date" while retaining old bytes; verify the cache
and use a native reinstall with `--keep-data` when it needs refreshing.

If verification fails, keep the new repository private and fix the failing check.
Do not restore public access to the historical repository as a rollback.
