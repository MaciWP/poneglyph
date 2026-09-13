---
name: frontend-craft
description: |
  Diseña interfaces y adapta componentes al estilo de la aplicación. Comprueba usos compartidos, estados y accesibilidad. Úsala al modificar UI compartida, crear pantallas o revisar consistencia visual.
metadata:
  keywords: ui compartida, cambia el hover, ajusta el badge, consistencia visual, diseño de interfaz, diseña la pantalla
disable-model-invocation: false
when_to_use: |
  "cambia el hover de este componente", "¿dónde más se usan estos badges?",
  "que use el mismo estilo que el resto de la app", "diseña la pantalla nueva",
  "esto parece hecho por una IA", "no queda profesional"
---

# frontend-craft — consistency first, craft floor second

UI work calibrated by measured evidence (029 analysis): in Oriol's real work
there were ZERO "generic AI UI" complaints — the real friction is SEMANTIC and
CONSISTENCY-shaped ("same hover as the rest of the app", "where else are these
badges used?" — sweeps the user had to initiate manually, 4 times). So
consistency mode is the DEFAULT; the aesthetic craft mode serves new surfaces
and personal projects. Adapted from Impeccable (Apache 2.0, pbakaus/impeccable);
Anthropic's `frontend-design` plugin covers new-build aesthetic direction — this
skill points there instead of duplicating it.

## Mode 1 — Consistency (default for work repos)

**Before the first edit to any shared UI element:**

1. **Usage sweep**: enumerate every usage of the touched component/token
   (Grep references) and NAME the affected screens — proactively, without
   being asked. A shared symbol changed without its usages checked is the
   measured failure mode (a badge restyle ticket: 3 rounds + 3 follow-up sessions).
2. **Pattern extraction**: read 2-3 sibling components — hover/focus behavior,
   spacing scale, color tokens, state handling. The app's existing pattern IS
   the spec; deviations need the user's explicit ask.

**After editing:** verify same-pattern conformance across the named usages
(the `verify` skill's impact sweep covers the mechanical side).

## Mode 2 — Craft (new surfaces, personal projects)

1. **Mode per surface** — choose per surface, not per product: **Persuade**
   (landing/marketing) · **Operate** (tools, dashboards) · **Read**
   (docs, long-form) · **Experience** (immersive). A tool's landing page is
   still Persuade; a fashion house's docs are still Read. Applying
   landing-page energy to a dashboard is the classic failure.
2. **The craft floor** — numeric checks + the refuse-list of AI tells:
   `references/craft-floor.md`. Read it BEFORE building, apply it silently
   (never announce the checklist).
3. **Aesthetic direction** for genuinely new visual worlds → the installed
   `frontend-design` plugin skill (do not duplicate it here).

## Shared rules (both modes)

- **Bounded verification**: ONE batched inspection round (screenshots from the
  user — the browser connector is unreliable, memoria 2026-06) + at most one
  confirm round. Open-ended self-QA burns money.
- **The brief wins**: the user's committed aesthetic beats any pattern warning.
- **Refinement preserves; redesign replaces** — never bulldoze a committed
  look while "polishing".
- Design iteration not converging after 2-3 rounds → ask for a concrete
  reference (Linear/Vercel/…), don't keep iterating by intuition (memoria).

## Commandments cubiertos

| # | Cómo |
|---|---|
| I | El usage sweep entiende el blast radius visual ANTES de tocar |
| V | Consistencia con lo existente > invención; el floor evita el genérico sin maquinaria |
| X | Verificación acotada (1+1 rondas) — nunca self-QA abierto |
