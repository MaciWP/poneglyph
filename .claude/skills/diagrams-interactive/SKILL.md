---
name: diagrams-interactive
description: >-
  Construye diagramas técnicos interactivos con Archify (arquitectura, procesos,
  secuencia de llamadas, flujo de datos, ciclo de vida) como JSON editable y una página
  HTML navegable con temas y exportación. Aplica cuando hay que entender o enseñar cómo
  encajan las piezas de un sistema. Úsala para "hazme un diagrama interactivo",
  "visualiza la arquitectura", "dibuja el flujo de datos de este servicio", "convierte
  este Mermaid en algo explorable". No es para un diagrama sencillo en el chat (Mermaid)
  ni para un informe (html-report).
---

# Archify

Use the official Archify package unchanged. This entrypoint connects its authoring
contract to Poneglyph's shared installation and the user's target project.

## Definition of Done

- Resolve the requested system or flow, audience, relationships and task-specific quality priorities before authoring; reuse the agreed brief.
- Deliver editable JSON and self-contained HTML through the existing engine. Validate the data and inspect the rendered diagram and applicable controls.
- Stop after the requested relationships are clear and the artifact is verified. Missing engine or rendering evidence remains an explicit limitation.

## Quality Bar

- Success means accurate relationships, readable navigation and a usable delivered artifact.
- More nodes, decoration or repeated visual polishing add no value once the brief and checks are satisfied.

## Resolve the engine

Resolve this skill directory to its real filesystem location before deriving paths.
The Poneglyph root is three directories above it. The versioned engine location and
native setup recipe are in [references/integration.md](references/integration.md).
Reuse the installed package; install it from that recipe only when absent.
Do not install another discoverable upstream skill or add npm dependencies.

Read the installed engine's `SKILL.md` in full. Treat every upstream relative path
as relative to the engine directory, never to the target project. Run its Node CLI
directly with quoted absolute input/output paths. Keep the user's target project
separate from the Poneglyph installation.

## Author and deliver

1. Name the technical question the diagram must answer. Follow the installed
   `SKILL.md` fast authoring path and select its matching schema and example.
   Use examples for structure, never for repository facts.
   Inspect the target source; distinguish user descriptions from observed code.
2. For exploration or presentation requests, read the installed
   `references/viewer-runtime.md`. Select guided chapters, tracing, semantic
   navigation, and presentation features that explain the question. Each chapter
   must expose a useful relationship or decision; more nodes are not a quality
   target. Use the official scenario guide and examples instead of building UI.
3. Read the installed `references/authoring-contract.md` when source evidence or advanced
   composition is needed. Use supported source references for verified repository
   facts. Never claim that references or a snapshot track future code changes.
   Preserve the original viewer and its defaults unless the request selects a
   presentation style or motion. Follow the installed language contract and
   disclose unsupported viewer translations; preserve technical identifiers.
4. Keep editable JSON and HTML together in the target project's artifact location.
   Follow the installed `references/delivery-contract.md` for validation, delivery, visual review,
   and exports. Inspect the screenshots and exercise the selected reader features.
   Require upstream acceptance and a readable composition.
   Report unavailable checks and unresolved findings. Revisions edit JSON and
   rerun the official CLI; never patch generated HTML or engine files.
5. Follow the installed `SKILL.md` update awareness at its prescribed point.
   Keep the pinned engine unchanged until the user requests an update. Re-read
   the new engine's contracts after an approved update; do not maintain local
   copies of its feature lists, schemas, templates, or acceptance rules.

Return the HTML and editable JSON links, type, validation result, and actual visual
review status. Include receipt paths when useful. Do not infer exceptional quality,
model-token savings, or platform compatibility from a successful render alone.

## Boundaries

Use Mermaid for a simple inline diagram that fully answers the request. Use Archify
when technical graph exploration or a standalone interactive diagram helps, or when
explicitly requested. Use html-report for reports and dashboards, including dynamic
reports.

## Content map

| Topic | File | Read when |
|---|---|---|
| Engine and environment | [references/integration.md](references/integration.md) | Resolve the cache, install the official package, or configure browser discovery. |

Commandments: II (verified facts), IV (observed delivery), V and IX (upstream reuse),
X (cached runtime and focused reference reads).
