export const meta = {
  name: 'flow-build',
  description: 'Mitad trasera de /flow como pipeline determinista: ejecuta las HUs pendientes de un plan aprobado por waves del DAG (agentes sonnet), verifica por HU, y cierra con checks base + UN fresh reviewer. Los gates humanos (verdict, retro) quedan fuera: devuelve estado por HU para que el Lead cierre con el usuario.',
  whenToUse: 'Plan /flow con tasks/ aprobado y fase 2.5 cerrada, cuando el usuario pide ejecutar el build en paralelo con agentes (opt-in explícito; sobrecoste ~2-4x tokens en la fase build a cambio de reloj ÷ paralelismo).',
  phases: [
    { title: 'Discover', detail: 'leer state.json + tasks/ del plan (1 agente lector)' },
    { title: 'Build', detail: 'HUs por waves del DAG — paralelo si ficheros disjuntos, secuencial si colisionan', model: 'sonnet' },
    { title: 'Review', detail: 'suite completa + UN fresh reviewer (opus, correctness/requirements)' },
  ],
}

// args: { slug: "NNN-slug" } — el plan a ejecutar. El script NO toca disco
// (los workflows no tienen filesystem); todo I/O pasa por agentes.
// Doctrina (029/US9): unidades en sonnet; reviewer en opus con razón declarada;
// NUNCA el modelo de sesión en unidades. Gates humanos fuera del script.
const slug = typeof args === 'string' ? args : args?.slug
if (!slug) throw new Error('flow-build necesita args.slug (p.ej. {"slug":"032-mi-feature"})')

const PLAN = `.claude/plans/${slug}`

// ---------- Phase 1: Discover (1 reader agent, cheap) ----------
phase('Discover')

const DISCOVER_SCHEMA = {
  type: 'object',
  required: ['ready', 'reason', 'check_command', 'us'],
  properties: {
    ready: { type: 'boolean' },
    reason: { type: 'string' },
    check_command: { type: 'string' },
    us: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'wave', 'depends_on', 'files', 'execution_prompt'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          wave: { type: 'number' },
          depends_on: { type: 'array', items: { type: 'string' } },
          files: { type: 'array', items: { type: 'string' } },
          execution_prompt: { type: 'string' },
          tdd_mode: { type: 'string' },
        },
      },
    },
  },
}

const plan = await agent(
  `Read the /flow plan at ${PLAN} in this repo. ` +
    `1) Read ${PLAN}/state.json — the plan is ready ONLY if tasks are approved and phase 2.5 closed (tests.md or validations.md exists) and us_pending is non-empty; otherwise return ready:false with the reason. ` +
    `2) For each US id in us_pending, read ${PLAN}/tasks/US{n}.md and extract: id, title, wave number, depends_on (array of US ids), files (paths it may touch), the FULL "Execution prompt (Phase 3 input)" block verbatim as execution_prompt, and tdd_mode if declared. ` +
    `3) check_command = the project verification command (project CLAUDE.md §verification or .claude/rules/test-policy.md). ` +
    `Return ONLY the structured object.`,
  { label: 'discover:plan', phase: 'Discover', schema: DISCOVER_SCHEMA, model: 'sonnet', effort: 'low' },
)

if (!plan || !plan.ready) {
  return { aborted: true, reason: plan ? plan.reason : 'discover agent failed' }
}
log(`${plan.us.length} HUs pendientes; check: ${plan.check_command}`)

// ---------- Phase 2: Build por waves (barrier entre waves = dependencias reales) ----------
// Dentro de una wave: HUs con ficheros DISJUNTOS corren en paralelo en el repo real;
// HUs cuyos ficheros solapan van al final de la wave en SECUENCIAL (sin worktrees:
// evita costuras de merge — la colisión se resuelve por orden, no por aislamiento).
const HU_SCHEMA = {
  type: 'object',
  required: ['id', 'status', 'summary', 'files_touched', 'check'],
  properties: {
    id: { type: 'string' },
    status: { enum: ['done', 'blocked', 'failed'] },
    summary: { type: 'string' },
    files_touched: { type: 'array', items: { type: 'string' } },
    check: { type: 'string' },
    question: { type: 'string' },
  },
}

function huPrompt(u) {
  return (
    `You are executing ONE user story of an approved /flow plan, inline-quality bar. ` +
    `Plan: ${PLAN}. US: ${u.id} — ${u.title}.\n\n` +
    `PRIMARY INSTRUCTION (execution prompt from tasks/${u.id}.md):\n${u.execution_prompt}\n\n` +
    `Constraints: honor ${PLAN}/tests.md or validations.md for this US (red→green when tdd forced${u.tdd_mode ? `; declared tdd_mode: ${u.tdd_mode}` : ''}). ` +
    `Follow the surrounding code style. Smallest diff that satisfies the ACs. ` +
    `Do NOT touch ${PLAN}/state.json or US frontmatter (the Lead closes state with the user). ` +
    `Do NOT git commit/push. ` +
    `If an AC is ambiguous and you would have to GUESS: do not improvise — return status:"blocked" with the exact question. ` +
    `Before returning done: run the scoped check for what you touched, then \`${plan.check_command}\`; failures → fix root cause or return failed. ` +
    `Return: id, status, summary (what changed + why, 3-5 lines), files_touched, check (the command run + pass/fail counts), question (only if blocked).`
  )
}

phase('Build')
const waves = [...new Set(plan.us.map((u) => u.wave))].sort((a, b) => a - b)
const results = []
const doneIds = new Set()

for (const w of waves) {
  const pending = plan.us.filter((u) => u.wave === w)
  // HUs cuyas dependencias fallaron/bloquearon no se ejecutan.
  const runnable = pending.filter((u) => u.depends_on.every((d) => doneIds.has(d) || !plan.us.some((x) => x.id === d)))
  const skipped = pending.filter((u) => !runnable.includes(u))
  for (const u of skipped) results.push({ id: u.id, status: 'blocked', summary: 'dependencia no cerrada', files_touched: [], check: '-', question: `depende de ${u.depends_on.join(', ')}` })

  // Partición por colisión de ficheros: disjuntas → paralelo; colisionantes → cola secuencial.
  const parallelGroup = []
  const sequentialQueue = []
  const claimed = new Set()
  for (const u of runnable) {
    const collides = u.files.some((f) => claimed.has(f))
    if (collides) sequentialQueue.push(u)
    else {
      u.files.forEach((f) => claimed.add(f))
      parallelGroup.push(u)
    }
  }
  if (sequentialQueue.length > 0) log(`wave ${w}: ${parallelGroup.length} en paralelo, ${sequentialQueue.length} en secuencial por colisión de ficheros`)

  const parallelResults = await parallel(
    parallelGroup.map((u) => () => agent(huPrompt(u), { label: `build:${u.id}`, phase: 'Build', schema: HU_SCHEMA, model: 'sonnet' })),
  )
  for (const r of parallelResults.filter(Boolean)) results.push(r)

  for (const u of sequentialQueue) {
    const r = await agent(huPrompt(u), { label: `build:${u.id}(seq)`, phase: 'Build', schema: HU_SCHEMA, model: 'sonnet' })
    if (r) results.push(r)
  }

  for (const r of results) if (r.status === 'done') doneIds.add(r.id)
}

// ---------- Phase 3: Review (suite completa + UN fresh reviewer) ----------
phase('Review')
const done = results.filter((r) => r.status === 'done')

const SUITE_SCHEMA = {
  type: 'object',
  required: ['command', 'pass', 'fail', 'output_tail'],
  properties: { command: { type: 'string' }, pass: { type: 'number' }, fail: { type: 'number' }, output_tail: { type: 'string' } },
}
const REVIEW_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'summary', 'locus'],
        properties: { severity: { enum: ['BLOCKER', 'MAJOR', 'MINOR', 'NIT'] }, summary: { type: 'string' }, locus: { type: 'string' }, us: { type: 'string' } },
      },
    },
  },
}

const [suite, review] = await parallel([
  () =>
    agent(
      `Run the project verification command \`${plan.check_command}\` at the repo root and report: command, pass count, fail count, and the last ~15 lines of output verbatim as output_tail. Do not fix anything.`,
      { label: 'review:suite', phase: 'Review', schema: SUITE_SCHEMA, model: 'sonnet', effort: 'low' },
    ),
  done.length > 0
    ? () =>
        agent(
          // Fresh-context reviewer: opus con razón — es el juicio de correctness del
          // feature (P1-exception de critic; su valor ES el contexto fresco).
          `You are a FRESH-CONTEXT reviewer, read-only, constrained to CORRECTNESS and REQUIREMENTS only (no style, no perf). ` +
            `Plan: ${PLAN}. Read ${PLAN}/spec.md and, for each of these completed US ids, its tasks/US{n}.md ACs: ${done.map((r) => r.id).join(', ')}. ` +
            `Then read the current git diff (git diff HEAD --stat, then the relevant files) and TRACE each AC to the diff. ` +
            `Flag: AC without implementation, implementation contradicting an AC, happy-path breaks. ` +
            `Return findings [{severity, summary, locus (file:line), us}] — empty array if clean.`,
          { label: 'review:fresh-reviewer', phase: 'Review', schema: REVIEW_SCHEMA, model: 'opus' },
        )
    : () => Promise.resolve({ findings: [] }),
])

// ---------- Handback al Lead (gates humanos fuera del script) ----------
return {
  slug,
  per_hu: results,
  done: done.map((r) => r.id),
  blocked: results.filter((r) => r.status === 'blocked').map((r) => ({ id: r.id, question: r.question })),
  failed: results.filter((r) => r.status === 'failed').map((r) => r.id),
  suite,
  reviewer_findings: review ? review.findings : null,
  next: 'El Lead cierra: flow-state close-us por HU done (tras validar), resuelve blocked con el usuario, y corre /critic para el verdict humano.',
}
