---
name: ui-design
description: >-
  Diseña y ajusta la interfaz con el estilo de la app: pantallas nuevas, componentes,
  estados, hover, espaciado y accesibilidad, comprobando dónde más se usa un componente
  compartido. Úsala para "diseña la pantalla nueva", "cambia el hover de este botón",
  "que use el mismo estilo que el resto", "esto no queda profesional", "parece hecho
  por una IA", "¿dónde más se usan estos badges?". No es para un informe o dashboard HTML suelto (html-report).
disable-model-invocation: false
---

# ui-design: consistency first, craft floor second

In the user's UI work the friction is semantic consistency ("same hover as the
rest of the app", "where else are these badges used?"), not generic-looking UI.
So consistency mode is the default; the aesthetic craft mode serves new surfaces
and personal projects. Adapted from Impeccable (Apache 2.0, pbakaus/impeccable).
Craft-mode direction is agreed with the user; `references/craft-floor.md` is the
floor, not the brief.

## Definition of Done

- Select consistency or craft mode per requested surface. Reuse or define required states, shared consumers, observable acceptance and task-specific quality priorities before edits.
- Deliver the requested design or verified UI change with applicable accessibility and shared-usage checks. Report any unobserved visual behavior.
- Stop when the brief and checks pass. Apply the bounded inspection rules; do not redesign a committed direction while polishing.

## Quality Bar

- Success means usable requested states, consistency, accessibility and fidelity to the brief.
- Novelty, extra screens and additional visual iterations add no value without a concrete unmet criterion.

## Mode 1: Consistency (default for work repos)

**Before the first edit to any shared UI element:**

0. **Design file**: read `docs/DESIGN_SYSTEM.md`, `DESIGN_SYSTEM.md`,
   `DESIGN.md` before UI edits; cite it. None: offer extraction through the host's
   question tool (Claude Code: `AskUserQuestion`), even among other decisions; no file until yes
   (`references/design-file.md`).
1. **Usage sweep**: enumerate every usage of the touched component/token
   (Grep references) and NAME the affected screens, proactively. A shared
   symbol changed without its usages checked is the failure this step
   prevents.
2. **Pattern extraction**: read 2-3 sibling components, hover/focus behavior,
   spacing scale, color tokens, state handling. The app's existing pattern IS
   the spec; deviations need the user's explicit ask.

**After editing:** verify same-pattern conformance across the named usages
(the `changes-verify` skill's impact sweep covers the mechanical side).

## Mode 2: Craft (new surfaces, personal projects)

1. **Mode per surface**: choose per surface, not per product: **Persuade**
   (landing/marketing) · **Operate** (tools, dashboards) · **Read**
   (docs, long-form) · **Experience** (immersive). A tool's landing page is
   still Persuade; a fashion house's docs are still Read. Applying
   landing-page energy to a dashboard is the classic failure.
2. **The craft floor**: numeric checks + the refuse-list of AI tells:
   `references/craft-floor.md`. Read it before building, apply it silently
   (never announce the checklist).
3. **Aesthetic direction** for genuinely new visual worlds → agree mode,
   reference and palette with the user first (do not invent it here).

## Shared rules (both modes)

- **Design file**: step 0 applies in Mode 2 too.
- **Bounded verification**: ONE batched inspection round (screenshots from the
  user) + at most one
  confirm round. Open-ended self-QA burns money.
- **The brief wins**: the user's committed aesthetic beats any pattern warning.
- **Refinement preserves; redesign replaces**; never bulldoze a committed
  look while "polishing".
- Design iteration not converging after 2-3 rounds → ask for a concrete
  reference (Linear/Vercel/…), don't keep iterating by intuition (memoria).

## Commandments cubiertos

| # | Cómo |
|---|---|
| I | El usage sweep entiende el blast radius visual ANTES de tocar |
| V | Consistencia con lo existente > invención; el floor evita el genérico sin maquinaria |
| X | Verificación acotada (1+1 rondas): nunca self-QA abierto |
