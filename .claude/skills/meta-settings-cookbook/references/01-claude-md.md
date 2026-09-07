# CLAUDE.md Reference

## What It Is

Project instructions loaded into every session. Claude reads them as context but they are user messages, not enforced config.

## Locations & Precedence (specific > broad)

| Scope | File | Shared |
|-------|------|--------|
| Managed | System-level `CLAUDE.md` | Org-wide |
| Project | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team (VCS) |
| User | `~/.claude/CLAUDE.md` | Personal (all projects) |
| Local | `./CLAUDE.local.md` | Personal (this project) |

Loading: walks UP directory tree from cwd. `CLAUDE.local.md` appended after `CLAUDE.md` at each level.

## Template: Project CLAUDE.md

```markdown
# Project Name

## Tech Stack
- Language: TypeScript
- Runtime: Bun
- Framework: Elysia
- Database: PostgreSQL + Drizzle ORM

## Conventions
- Use typed errors, never throw raw strings
- All API responses follow `{ data, error }` pattern
- Tests colocated with source: `foo.test.ts` next to `foo.ts`

## Commands
- `bun test` — run all tests
- `bun run dev` — start dev server
- `bun run build` — production build

## Architecture
- `src/routes/` — API endpoints
- `src/services/` — business logic
- `src/data/` — database access
- `src/utils/` — shared utilities
```

## Import Syntax

`@path/to/file` — expands file inline (max 5 hops deep). Use for splitting large CLAUDE.md:

```markdown
@.claude/rules/<your-rule>.md
@.claude/rules/<another-rule>.md
```

> Illustrative paths — replace with your project's actual rule files. (These example names are not real poneglyph rules.)

## Gotchas

| Gotcha | Detail |
|--------|--------|
| Not enforced config | CLAUDE.md is a user message, can be overridden. Use `--append-system-prompt` for system-level enforcement |
| HTML comments stripped | `<!-- ... -->` removed before injection (saves tokens) |
| After /compact | Project-root CLAUDE.md re-injected; nested ones only reload when their subdirectory is accessed |
| Size matters | Large CLAUDE.md = more input tokens per request. Move detailed patterns to skills |
| `claudeMdExcludes` | Setting to skip specific CLAUDE.md files by glob |
