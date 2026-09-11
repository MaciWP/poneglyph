---
parent: meta-harness
name: t13-output-style
description: T13 output-style pack — Claude-only system-prompt styles. Codex and Grok cells ausente. Theme/persona is not this type.
---

# T13 — Output style

Shared: [lookup.md](lookup.md) · [lifecycle.md](lifecycle.md) · [t10-settings.md](t10-settings.md).
Absorbs cookbook `03-output-styles.md` (D27).

## 1. What / when

Claude-only files that **replace** (or keep) the coding system prompt: tone/format of the assistant. Not a skill. Not a TUI theme. Not a Grok persona.

## 2. Lookup

Claude output-styles docs. Codex: **no** output-style file type (`tui.theme` is syntax highlighting). Grok: `06-theming.md` is TUI colors; personas are T3-adjacent, not this type.

## 3. Vendor declare

| | Claude Code | Codex | Grok Build |
|---|---|---|---|
| Path | `~/.claude/output-styles/`; `.claude/output-styles/`; plugin `output-styles/` | **ausente** as this type | **ausente** as this type |
| Frontmatter | `name`, `description`, `keep-coding-instructions` (default `false`) | n/a | n/a |
| Activate | `outputStyle` in settings; `/config` → Output style. `/output-style` **ausente** (removed v2.1.91) | n/a | n/a |
| Reload | New session (prompt cache) | n/a | n/a |
| Nearby (not T13) | — | `tui.theme` = syntax highlighter | `[ui] theme`; `/theme`; personas |

`keep-coding-instructions: false` removes coding-specific system prompt. Set `true` for coding styles. This repo's house style is `Poneglyph` (`output-styles/poneglyph.md`); hosts without output styles consume `.claude/system-prompts/poneglyph-sp.md` (generated — do not edit by hand).

## 4. Min template

Claude-only (do not copy this directory to Codex/Grok):

```markdown
---
name: {{StyleName}}
description: {{When this style applies}}
keep-coding-instructions: true
---

{{Rules for how the assistant writes}}
```

## 5. Evidence

T1 + B: Claude output-styles page; Grok 06-theming.md 2026-09-10. D13: Codex/Grok ausente. **sin evidencia A/B** for “styles beat CLAUDE.md tone notes”.

## 6. Poneglyph grain

Do not sell Grok theming or Codex `tui.theme` as this type. Sync generates the system-prompt twin — this pack does not rewrite sync.

## 7. Absences

| Cell | Status |
|---|---|
| Codex output-style directory | **ausente** — `tui.theme` is not this type |
| Grok output-style directory | **ausente** — theme/persona ≠ output-style |
| Copy `.claude/output-styles/` into Grok | **ausente** |
| `/output-style` slash command | **ausente** — removed v2.1.91; use `/config` |
