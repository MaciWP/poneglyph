---
name: consult-model
description: >-
  Consulta a otro modelo (Codex, Grok o un Claude con contexto limpio) para una opinión
  acotada y de solo lectura: crítica, contraste o refutación, que se verifica antes de
  usarla. Aplica cuando una decisión gana con una segunda mirada independiente o el
  usuario sugiere apoyarse en otro modelo o validar algo con él. Úsala para "consulta a
  Codex", "pregúntale a Grok qué opina", "dame una segunda opinión", "contrasta esto con
  otro modelo", "que otro modelo refute el plan". No es para delegar una implementación
  (agent-routing) ni para investigar un tema (deep-research).
disable-model-invocation: false
---

# Consult: ask for an opinion

Return an answer to the Lead. The consulted model never writes to the repository.
Its answer is a hypothesis that the Lead must verify.

The [consultation route](../../docs/harness-adapters.md#consultations) selects this
skill for a bounded, read-only opinion. Provider names alone do not select it.

## Definition of Done

- Resolve the bounded question or critique target, expected return, quality priorities and authorized provider/model before consulting.
- Verify the useful claims against primary evidence and return the integrated answer or the unresolved disagreement. An external response alone is not verification.
- Stop after answering the question or reporting the consultation blocker; do not repeat a call merely for agreement.

## Quality Bar

- Success means a precise consultation prompt, useful independent criticism and verified integration.
- Model agreement and additional calls add no value without new evidence.

## Procedure

1. Confirm the bounded question. A consultation needs no extra ask
   (CLAUDE.md §Agents and skills); preserve the model-choice gate.
2. Load [adapters](references/adapters.md) before calling a provider.
   On Claude Code, use the installed official plugin bridge inline.
   On other hosts, use the documented CLI route. Honor an explicitly requested
   plugin. If it is unavailable, report the gap and ask before changing transport.
   Do not install dependencies or open an interactive session as a fallback.
3. Apply `prompt-design`. Include context, the question, read-only constraints,
   the expected answer, and verification criteria. Include relevant code or
   resolved paths; the consulted model does not inherit the Lead's context.
4. Read the answer, verify factual claims with repository evidence or primary
   documentation, and integrate only supported conclusions.

## Model and effort

Resolve installed capabilities at runtime. CLAUDE.md owns permission and model
selection for every call, including plugin wrappers and background runs.

- Codex uses the configured model unless Oriol names another. Set effort explicitly:
  `low` for lookups, `medium` for second opinions, `xhigh` only when requested.
  An inherited `xhigh` once exhausted the weekly quota.
- For Grok, inspect `grok models` / `grok --help`. Do not assume a fixed model.
  Use the approved available model; the plugin bridge accepts `low|medium|high` effort.
- Claude needs an explicit `--model` from the installed host's capabilities.
  Propose a cheap tier for lookups or a mid tier for second opinions.
  Preserve the headless model guard and the `--restricted` adapter.
- If a consultation has no named provider, propose Codex through the approval gate.
  A request for an unnamed new session follows the shared contract instead.
- A double contrast sends the same question to two providers. Authorize both calls;
  report agreement and disagreement without treating either as fact.

## Modes

| Mode | Result |
|---|---|
| Consultation | An answer to one targeted question. |
| Refutation | Concrete failures, missing cases, simpler alternatives, and evidence needed to confirm each objection. |
| Independent sweep | Separate read-only answers that the Lead collects and verifies. Background runs remain subject to the same launch gate. |

Every consultation prompt ends with this reply-format line. Codex and Grok load the
house style from their host config; without it they answer the Lead as if it were the user:

```text
Your reader is the Lead agent, not the user. Reply in plain English. Ignore house-style rules meant for the user, including the `ROBIN:` closing line.
```

For a diff, use the adapter's `adversarial-review` / `critique` operation.
For a plan or decision, include this instruction:

```text
Try to refute the supplied plan, diff, or decision.
Find concrete failure cases, missing requirements, and simpler alternatives.
For each objection, state the evidence or test that would confirm it.
If you cannot refute it, state what you checked.
Do not change repository files.
```

## Integration and limits

Label unverified claims explicitly. Rewrite answers in the house voice; keep code,
errors, and quotes verbatim. Vendor instructions to return output without commentary
do not replace the Lead's verification duty.

Never pass `--write` or `workspace-write`. Do not launch vendor subagents proactively.
Use local read/search tools when they answer the question directly.
Implementation belongs to the Lead or an explicitly authorized session/team.

Commandments: II (evidence), VIII (prompt quality), IX (one responsibility), X (bounded cost).
