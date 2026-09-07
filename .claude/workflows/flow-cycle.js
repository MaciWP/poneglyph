export const meta = {
  name: 'flow-cycle',
  description:
    'Ciclo trasero de /flow COMPLETO y determinista: preflight del plan, build por waves con la disciplina de la skill build (style anchors, oracle red→green, drillme intra-HU, docs-sync, retry con diagnóstico), fase 4 estilo critic (base checks + fresh reviewer + review-patterns + security condicional + spec-drift) y review.md escrito desde el template con veredicto PROPUESTO. Los gates humanos (ratificar veredicto, retro, state.json) quedan fuera.',
  whenToUse:
    'Plan /flow con tasks/ aprobado y fase 2.5 cerrada, cuando quieres el ciclo trasero COMPLETO — build + fase 4 con artefacto review.md — y no solo ejecutar las HUs. Para el camino barato (build + suite + UN reviewer, sin artefacto) usa flow-build. Opt-in explícito: ~2x el coste de flow-build por la fase 4 instrumentada.',
  phases: [
    { title: 'Preflight', detail: 'readiness del plan + comandos de verificación + review_level + fecha (1 agente lector)' },
    { title: 'Build', detail: 'HUs por waves del DAG con la disciplina de build/SKILL.md; 1 retry con diagnóstico', model: 'sonnet' },
    { title: 'Review', detail: 'base checks + fresh reviewer (opus) + review-patterns + security-audit condicional' },
    { title: 'Synthesize', detail: 'veredicto determinista + writer escribe review.md desde el template' },
  ],
}

// ---------------------------------------------------------------------------
// Contrato con /flow (commands/flow.md) y con las skills de fase:
//   · Fase 3 = build/SKILL.md   → steps 4-9 destilados en el prompt de HU.
//   · Fase 4 = critic/SKILL.md  → steps 4-10 repartidos entre Review + Synthesize.
// Invariantes que hacen seguro el handback:
//   1. NINGÚN agente escribe state.json ni frontmatter de US — cierra el Lead
//      con `flow-state close-us` tras validar contigo.
//   2. NINGÚN agente hace git commit/push.
//   3. El veredicto se calcula en el SCRIPT (determinista) y es PROPUESTO;
//      lo ratifica el humano vía `flow-state verdict`.
//   4. La retro (fase 5) queda fuera: se devuelven sus INPUTS como datos —
//      escribir retro.md sin ratificación humana rompería `close-feature`.
// Restricciones del runtime: el script no tiene filesystem (todo I/O va por
// agentes) y Date.now()/new Date() lanzan → la fecha la trae el preflight.
// ---------------------------------------------------------------------------

// args: "NNN-slug" | { slug, only?: ["US1"], level?: "light|standard|full" }
const input = typeof args === 'string' ? { slug: args } : args || {}
const slug = typeof input.slug === 'string' ? input.slug.trim() : undefined
const only = Array.isArray(input.only) ? input.only : null
const levelOverride = ['light', 'standard', 'full'].includes(input.level) ? input.level : null

// El slug es una ruta de plan, no prosa: validar la forma evita que una frase
// del usuario se interpole como directorio y el preflight falle en oscuro.
if (!slug || !/^\d{3}-[a-z0-9][a-z0-9-]*$/.test(slug)) {
  return {
    aborted: true,
    reason:
      `flow-cycle necesita el slug de un plan con forma NNN-kebab. Recibido: ${JSON.stringify(args)}. ` +
      `Uso: Workflow({name:"flow-cycle", args:{slug:"032-mi-feature"}}) — opcionales: only:["US3"], level:"full".`,
  }
}

const PLAN = `.claude/plans/${slug}`
const NO_WRITE = // prohibiciones comunes a todos los agentes que tocan el repo
  `NEVER touch ${PLAN}/state.json or the frontmatter of ${PLAN}/tasks/US*.md (the Lead closes state with the user). ` +
  `NEVER run git commit/push/checkout/reset. ` +
  `NEVER edit sensitive paths (.env, *.lock, package.json, .claude/settings*.json, secrets/, credentials/): if the work requires one, stop and report it as blocked with the reason.`

// ---------------------------------------------------------------------------
// Fase 1 — Preflight: un solo lector barato resuelve TODO el contexto que el
// script necesita (readiness, comandos, oracle, fecha, HUs con su prompt).
// ---------------------------------------------------------------------------
phase('Preflight')

const PREFLIGHT_SCHEMA = {
  type: 'object',
  required: ['ready', 'reason', 'today', 'check_command', 'oracle_source', 'review_level', 'review_level_reason', 'spec_summary', 'us'],
  properties: {
    ready: { type: 'boolean' },
    reason: { type: 'string' },
    today: { type: 'string', description: 'YYYY-MM-DD obtenido con `date +%F` — el script no puede calcularlo' },
    check_command: { type: 'string' },
    typecheck_command: { type: 'string' },
    lint_command: { type: 'string' },
    oracle_source: { enum: ['tests.md', 'validations.md', 'both', 'none'] },
    test_policy: { type: 'string' },
    review_level: { enum: ['light', 'standard', 'full'] },
    review_level_reason: { type: 'string' },
    spec_summary: { type: 'string', description: 'problema + ACs de spec.md, ≤15 líneas' },
    us: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'wave', 'depends_on', 'files', 'execution_prompt', 'oracle_mode'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          wave: { type: 'number' },
          depends_on: { type: 'array', items: { type: 'string' } },
          files: { type: 'array', items: { type: 'string' } },
          execution_prompt: { type: 'string' },
          oracle_mode: { enum: ['forced', 'optional', 'validation', 'skip'] },
          oracle_ref: { type: 'string', description: 'p.ej. "tests.md §T3.*" o "validations.md §US3"' },
          oracle_skip_reason: { type: 'string' },
        },
      },
    },
  },
}

const plan = await agent(
  `Read the /flow plan at ${PLAN} in this repo and return its execution context. Read-only: do not modify anything.\n` +
    `1) ${PLAN}/state.json — ready:true ONLY if tasks are approved, phase 2.5 is closed (tests.md or validations.md exists) and us_pending is non-empty. Otherwise ready:false with a one-line reason naming what is missing.\n` +
    `2) today = output of \`date +%F\` (run it, do not guess the date).\n` +
    `3) For each US id in us_pending, read ${PLAN}/tasks/US{n}.md and extract: id, title, wave, depends_on, files, and the FULL "Execution prompt (Phase 3 input)" block VERBATIM as execution_prompt.\n` +
    `   oracle_mode per US, from ${PLAN}/tests.md frontmatter (tdd_policy) + per-node overrides + .claude/rules/test-policy.md: "forced" (strict red→green), "optional" (impl + suite verify), "validation" (markdown/config US covered by validations.md), "skip" (node carries tdd-skip: <reason> → copy it into oracle_skip_reason). oracle_ref = the exact section that covers this US.\n` +
    `4) check_command / typecheck_command / lint_command = the project's verification commands (project CLAUDE.md, .claude/rules/test-policy.md). Empty string when the project has none. test_policy = the declared level.\n` +
    `5) spec_summary = problem statement + acceptance criteria of ${PLAN}/spec.md, condensed to ≤15 lines (the review writer works from this).\n` +
    `6) review_level per critic/SKILL.md Step 3: "light" (1-2 HUs, no security/perf surface), "standard" (3-N HUs, no critical area), "full" (architectural, or the diff will touch auth/payments/secrets/crypto/session). Give the reason in one line.\n` +
    `Return ONLY the structured object.`,
  { label: 'preflight:plan', phase: 'Preflight', schema: PREFLIGHT_SCHEMA, model: 'sonnet', effort: 'low' },
)

if (!plan || !plan.ready) {
  return { aborted: true, slug, reason: plan ? plan.reason : 'preflight agent failed' }
}

const selected = only ? plan.us.filter((u) => only.includes(u.id)) : plan.us
if (selected.length === 0) {
  return { aborted: true, slug, reason: `only=${JSON.stringify(only)} no casa con ninguna HU pendiente (${plan.us.map((u) => u.id).join(', ') || 'ninguna'})` }
}
const level = levelOverride || plan.review_level
log(`${selected.length} HUs${only ? ' (subconjunto only)' : ''} · oracle: ${plan.oracle_source} · check: ${plan.check_command} · review_level: ${level}${levelOverride ? ' (override)' : ''}`)
if (selected.length > 10) log(`⚠️ ${selected.length} HUs: la wave más ancha se ejecuta igual, pero el runtime encola por encima de ~10 agentes concurrentes`)

// ---------------------------------------------------------------------------
// Fase 2 — Build por waves. Barrera entre waves = dependencias reales del DAG.
// Dentro de una wave: ficheros DISJUNTOS → paralelo; colisión → cola secuencial
// (el orden resuelve la colisión; worktrees añadirían costuras de merge).
// ---------------------------------------------------------------------------
const HU_SCHEMA = {
  type: 'object',
  required: ['id', 'status', 'summary', 'files_touched', 'oracle_evidence', 'check', 'drillme'],
  properties: {
    id: { type: 'string' },
    status: { enum: ['done', 'blocked', 'failed'] },
    summary: { type: 'string', description: 'qué cambió y por qué, 3-5 líneas' },
    files_touched: { type: 'array', items: { type: 'string' } },
    out_of_scope_files: { type: 'array', items: { type: 'string' }, description: 'tocados pero NO listados en el campo files de la US' },
    style_anchors: { type: 'array', items: { type: 'string' }, description: 'ficheros leídos como referencia de estilo antes de escribir' },
    oracle_evidence: { type: 'string', description: 'forced: error del rojo + confirmación del verde · validation: las 5 categorías · optional/skip: qué se verificó y con qué' },
    check: { type: 'string', description: 'comandos ejecutados + pass/fail' },
    drillme: { type: 'array', items: { type: 'string' }, description: '4 respuestas [approach]: patrón ignorado / duplicación / sobre-ingeniería / naming' },
    docs_sync: { type: 'string', description: 'doc de registro actualizado en la MISMA HU, o "n/a"' },
    questions: { type: 'array', items: { type: 'string' }, description: 'ambigüedades que exigirían adivinar (obligatorio si blocked)' },
    error: { type: 'string', description: 'mensaje de fallo exacto cuando status=failed' },
  },
}

function huPrompt(u, retryOf) {
  const oracle = {
    forced: `TDD forced — strict red→green: write the test from ${u.oracle_ref || `${PLAN}/tests.md`}, run it, VERIFY IT FAILS with the predicted error (a green before impl is a smell → stop and report blocked), then implement the minimum that turns it green. Record both the red error and the green run in oracle_evidence.`,
    optional: `TDD optional — implement, then run the suite as post-impl verification (${u.oracle_ref || plan.check_command}). Record what you ran in oracle_evidence.`,
    validation: `Validation-mode US (markdown/skill/doc/config) — verify the 5 categories of ${u.oracle_ref || `${PLAN}/validations.md`} for this US (Pre / Post / Structural / Smoke / Cross) and record each one in oracle_evidence. A failing Structural assertion (missing frontmatter field, broken reference) blocks the US.`,
    skip: `tdd-skip declared — reason is binding, do NOT relitigate it: "${u.oracle_skip_reason || 'declared in the plan'}". Implement directly and verify with the existing suite. If on inspection the skip looks wrong (the change DOES have testable behavior), say so in oracle_evidence; do not silently add tests.`,
  }[u.oracle_mode]

  return (
    `You are executing ONE user story of an approved /flow plan, at inline-Lead quality. Plan: ${PLAN}. US: ${u.id} — ${u.title}.\n\n` +
    (retryOf
      ? `RETRY (attempt 2 of 2). The previous attempt failed with:\n"""${retryOf}"""\nDiagnose the ROOT CAUSE first (5-whys / read the failing output / .claude/skills/diagnostic-patterns) and fix the cause, not the symptom. If you reproduce the very same error, stop and return status:"failed" with that error verbatim — do not keep retrying louder.\n\n`
      : '') +
    `PRIMARY INSTRUCTION (execution prompt from ${PLAN}/tasks/${u.id}.md — Task/Context/Constraints/Deliverable/Verify govern the work):\n${u.execution_prompt}\n\n` +
    `PROTOCOL (build/SKILL.md steps 4-9 — follow in order):\n` +
    `A. Style anchors BEFORE writing: Glob for 1-3 files of the same kind as your output and Read them; Grep the symbols/modules the US will use to confirm they exist. Report those files in style_anchors. Never claim a path exists without having seen it.\n` +
    `B. Oracle: ${oracle}\n` +
    `C. Scope floor: smallest diff that satisfies the ACs, in the surrounding code style. Reuse what the project already has instead of writing a variant. Add NOTHING beyond the ACs (no extra abstractions, hooks or fallbacks for impossible states). Never simplify away trust-boundary validation, error handling, security or accessibility. Stay inside the US files field (${u.files.join(', ') || 'declared in the US'}); anything else you had to touch goes in out_of_scope_files with the reason in summary.\n` +
    `D. Ambiguity: if an AC is ambiguous and you would have to GUESS (undefined signature, unspecified path/default, uncovered edge case), do NOT improvise — return status:"blocked" with the exact question in questions. Being blocked on a real question is a success; guessing is a failure.\n` +
    `E. Drillme before closing — answer these 4 in one line each, in this order: (1) is there a project pattern I ignored? (2) does my code duplicate an existing utility? (3) am I adding more than the AC requires? (4) are the names consistent with the codebase? A "yes" to (2) or (3) means FIX IT before returning.\n` +
    `F. Docs-sync in the SAME US: if you created or changed a component (hook, skill, command, rule, setting), update the doc that DESCRIBES it (registry tables such as .claude/rules/paths/hooks.md, .claude/docs/system-inventory.md). Report it in docs_sync, or "n/a".\n` +
    `G. Verify before returning done: run the scoped check for what you touched, then \`${plan.check_command}\`` +
    `${plan.typecheck_command ? ` and \`${plan.typecheck_command}\`` : ''}${plan.lint_command ? ` and \`${plan.lint_command}\`` : ''}. ` +
    `Failures caused by your change → fix the root cause. Pre-existing failures unrelated to your change → leave them and say so in check. If you cannot get to green, return status:"failed" with the exact error.\n\n` +
    `${NO_WRITE}\n` +
    `Return the structured object: id, status, summary, files_touched, out_of_scope_files, style_anchors, oracle_evidence, check, drillme (4 entries), docs_sync, questions, error.`
  )
}

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 300)

// Un reintento con diagnóstico (error-recovery.md); el identical-error override
// corta antes de gastarlo si el fallo no progresa.
// `seq` solo etiqueta: deja ver en el progreso qué HU se serializó por colisión.
async function runHU(u, seq) {
  const tag = `build:${u.id}${seq ? '(seq)' : ''}`
  const first = await agent(huPrompt(u, null), { label: tag, phase: 'Build', schema: HU_SCHEMA, model: 'sonnet' })
  if (!first) return { id: u.id, status: 'failed', summary: 'el agente murió sin devolver resultado', files_touched: [], oracle_evidence: '-', check: '-', drillme: [], error: 'agent returned null' }
  if (first.status !== 'failed') return first

  log(`↻ ${u.id} falló — 1 reintento con diagnóstico de causa raíz`)
  const second = await agent(huPrompt(u, first.error || first.check), { label: `${tag}(retry)`, phase: 'Build', schema: HU_SCHEMA, model: 'sonnet' })
  if (!second) return { ...first, error: `${first.error} · retry agent died` }
  if (second.status === 'failed' && norm(second.error) === norm(first.error)) {
    log(`⛔ ${u.id}: mismo error dos veces — se para (identical-error override), no se gasta más presupuesto`)
    return { ...second, error: `${second.error} [identical-error override: no progresa entre intentos]` }
  }
  return { ...second, summary: `${second.summary}\n(cerrada en reintento tras: ${norm(first.error)})` }
}

phase('Build')
const waves = [...new Set(selected.map((u) => u.wave))].sort((a, b) => a - b)
const results = []
const doneIds = new Set()
let retriedCount = 0

for (const w of waves) {
  const inWave = selected.filter((u) => u.wave === w)
  // Una HU cuya dependencia no cerró NO se ejecuta: ejecutar sobre una premisa
  // rota es la violación del DAG que /flow manda sacar a la luz, no absorber.
  const runnable = inWave.filter((u) => u.depends_on.every((d) => doneIds.has(d) || !selected.some((x) => x.id === d)))
  for (const u of inWave.filter((u) => !runnable.includes(u))) {
    results.push({ id: u.id, status: 'blocked', summary: 'dependencia no cerrada — violación del DAG', files_touched: [], oracle_evidence: '-', check: '-', drillme: [], questions: [`depende de ${u.depends_on.join(', ')}, que no cerró`] })
  }

  const parallelGroup = []
  const sequentialQueue = []
  const claimed = new Set()
  for (const u of runnable) {
    if (u.files.some((f) => claimed.has(f))) sequentialQueue.push(u)
    else {
      u.files.forEach((f) => claimed.add(f))
      parallelGroup.push(u)
    }
  }
  log(`wave ${w}: ${parallelGroup.length} en paralelo${sequentialQueue.length ? ` + ${sequentialQueue.length} en secuencial por colisión de ficheros` : ''}`)

  for (const r of (await parallel(parallelGroup.map((u) => () => runHU(u, false)))).filter(Boolean)) results.push(r)
  for (const u of sequentialQueue) results.push(await runHU(u, true))

  for (const r of results) if (r.status === 'done') doneIds.add(r.id)
}

retriedCount = results.filter((r) => /cerrada en reintento|identical-error/.test(r.summary || r.error || '')).length
const done = results.filter((r) => r.status === 'done')
const blocked = results.filter((r) => r.status === 'blocked')
const failed = results.filter((r) => r.status === 'failed')
const touched = [...new Set(done.flatMap((r) => [...(r.files_touched || []), ...(r.out_of_scope_files || [])]))]

// ---------------------------------------------------------------------------
// Fase 3 — Review (critic/SKILL.md steps 4-8). Fuentes INDEPENDIENTES sobre
// dominios DISJUNTOS: no es un panel deliberativo (019 demotion: los paneles
// sobre las mismas claims son la forma débil para revisar código).
// ---------------------------------------------------------------------------
phase('Review')

const CHECKS_SCHEMA = {
  type: 'object',
  required: ['checks', 'diff_stat'],
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'command', 'ok', 'detail'],
        properties: { name: { type: 'string' }, command: { type: 'string' }, ok: { type: 'boolean' }, detail: { type: 'string', description: 'pass/fail counts + últimas líneas relevantes' } },
      },
    },
    diff_stat: { type: 'string' },
  },
}

const finding = {
  type: 'object',
  required: ['severity', 'summary', 'locus', 'recommendation'],
  properties: {
    severity: { enum: ['BLOCKER', 'MAJOR', 'MINOR', 'NIT'] },
    summary: { type: 'string' },
    locus: { type: 'string', description: 'file:line exacto — sin "en algún sitio del módulo"' },
    recommendation: { type: 'string' },
    us: { type: 'string' },
  },
}
const FINDINGS_SCHEMA = { type: 'object', required: ['findings'], properties: { findings: { type: 'array', items: finding } } }
const REVIEWER_SCHEMA = {
  type: 'object',
  required: ['findings', 'spec_drift', 'spec_drift_note'],
  properties: {
    findings: { type: 'array', items: finding },
    spec_drift: { enum: ['none', 'legitimate', 'scope_creep', 'skipped_ac'] },
    spec_drift_note: { type: 'string' },
  },
}

const CODE_RE = /\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|sh|sql)$/
const SECURITY_RE = /(auth|payment|secret|credential|crypto|session|cookie|jwt|token|\.env)/i
const hasCode = touched.some((f) => CODE_RE.test(f))
const securityHit = touched.filter((f) => SECURITY_RE.test(f))
const filesLine = touched.join(', ') || '(ninguno)'
const doneIdsLine = done.map((r) => r.id).join(', ') || '(ninguna)'

// review_level modula el gasto (critic §Adaptation): light se queda en los
// checks mecánicos + reviewer; perf y security entran solo si hay superficie.
const wantReviewer = done.length > 0
const wantQuality = done.length > 0 && level !== 'light'
const wantPerf = hasCode && level === 'full'
const wantSecurity = securityHit.length > 0
if (wantSecurity) log(`🔒 security-audit disparado por: ${securityHit.join(', ')}`)
if (hasCode && level === 'standard') log('review-patterns performance omitido (level standard) — súbelo con level:"full" si el diff tiene hot paths')

const [base, reviewer, quality, perf, security] = await parallel([
  () =>
    agent(
      `Run the project's verification commands at the repo root and report each one, verbatim, without fixing anything:\n` +
        `- suite: \`${plan.check_command}\`\n` +
        (plan.typecheck_command ? `- typecheck: \`${plan.typecheck_command}\`\n` : '') +
        (plan.lint_command ? `- lint: \`${plan.lint_command}\`\n` : '') +
        `- diff: \`git diff HEAD --stat\` (and \`git status --porcelain\` if the diff is empty) as diff_stat.\n` +
        `For each: name, command, ok (true only if it exited clean), detail (pass/fail counts + the failing lines if any). Do not modify a single file.`,
      { label: 'review:base-checks', phase: 'Review', schema: CHECKS_SCHEMA, model: 'sonnet', effort: 'low' },
    ),
  wantReviewer
    ? () =>
        // La excepción P1 al árbol de spawn: el valor de este agente ES el
        // contexto fresco. Dominio acotado a correctness/requirements + drift.
        agent(
          `You are a FRESH-CONTEXT reviewer, READ-ONLY, constrained to CORRECTNESS and REQUIREMENTS only. Style, performance and maintainability are explicitly OUT of your scope — other reviewers own them.\n` +
            `1) Read ${PLAN}/spec.md (problem + ACs + out-of-scope) and, for each completed US (${doneIdsLine}), its ${PLAN}/tasks/US{n}.md ACs.\n` +
            `2) Read the delivered work: \`git diff HEAD\` on these files: ${filesLine}.\n` +
            `3) TRACE every AC to the diff. Flag: an AC with no implementation, an implementation that contradicts its AC, a happy path that breaks at the seams between US, and any edge case declared in ${PLAN}/tests.md or validations.md that nothing covers.\n` +
            `4) Classify spec_drift (critic Step 8): "none" · "legitimate" (divergence looks intentional and reasonable → propose the spec.md patch in spec_drift_note) · "scope_creep" (delivered more than spec.md asked) · "skipped_ac" (an AC silently dropped). Name the affected spec.md section in spec_drift_note.\n` +
            `Every finding carries an exact file:line you have actually read — no invented locations, no vague "somewhere in". Empty findings array is a valid, honest answer.`,
          { label: 'review:fresh-reviewer', phase: 'Review', schema: REVIEWER_SCHEMA, model: 'opus' },
        )
    : () => Promise.resolve({ findings: [], spec_drift: 'none', spec_drift_note: 'sin HUs cerradas que revisar' }),
  wantQuality
    ? () =>
        agent(
          `Apply the project's OWN quality catalog to the delivered diff. Read .claude/skills/review-patterns/references/01-mode-quality.md and the checklists under .claude/skills/review-patterns/references/quality/, then review \`git diff HEAD\` on: ${filesLine}.\n` +
            `Scope: SOLID/DRY violations, code smells, complexity, duplication of something the repo already has, over-engineering beyond the ACs, naming and comment noise, TODOs without a linked task. Correctness and security are NOT yours.\n` +
            `Read-only. Each finding: exact file:line, the catalog rule it breaks, and a concrete fix. Empty array if the diff is clean.`,
          { label: 'review:quality', phase: 'Review', schema: FINDINGS_SCHEMA, model: 'sonnet' },
        )
    : () => Promise.resolve({ findings: [] }),
  wantPerf
    ? () =>
        agent(
          `Apply the project's performance catalog to the delivered diff. Read .claude/skills/review-patterns/references/02-mode-performance.md and the checklists under .claude/skills/review-patterns/references/performance/, then review \`git diff HEAD\` on: ${filesLine}.\n` +
            `Scope: O(n²) where O(n) is reachable, I/O inside loops (N+1), missed batching/parallelism, unbounded buffers that should stream, leaks. Only flag what the DIFF introduces, on a path that can actually grow — do not report theoretical micro-optimizations.\n` +
            `Read-only. Each finding: exact file:line + concrete fix.`,
          { label: 'review:performance', phase: 'Review', schema: FINDINGS_SCHEMA, model: 'sonnet' },
        )
    : () => Promise.resolve({ findings: [] }),
  wantSecurity
    ? () =>
        // Cmd VI: en área crítica la seguridad es gate, no consejo.
        agent(
          `Security review of a diff that touches a critical area (${securityHit.join(', ')}). Read .claude/skills/security-audit/SKILL.md and apply its checklist to \`git diff HEAD\` on: ${filesLine}.\n` +
            `Scope: hardcoded secrets or credentials in code/logs, missing validation at trust boundaries, OWASP Top 10 vectors introduced by the diff (injection, XSS, IDOR, SSRF, broken auth), weakened crypto/session/cookie handling, secrets reaching stdout.\n` +
            `Read-only. A confirmed secret in code or an exploitable vector is BLOCKER — do not soften it. Each finding: exact file:line + the fix.`,
          { label: 'review:security', phase: 'Review', schema: FINDINGS_SCHEMA, model: 'sonnet' },
        )
    : () => Promise.resolve({ findings: [] }),
])

const tag = (res, source) => ((res && res.findings) || []).map((f) => ({ ...f, source }))
const findings = [
  ...tag(reviewer, 'fresh-reviewer'),
  ...tag(security, 'security-audit'),
  ...tag(quality, 'review-patterns:quality'),
  ...tag(perf, 'review-patterns:performance'),
]
const count = (s) => findings.filter((f) => f.severity === s).length
const findings_count = { blocker: count('BLOCKER'), major: count('MAJOR'), minor: count('MINOR'), nit: count('NIT') }
const checks = (base && base.checks) || []
const checksRed = checks.filter((c) => !c.ok)
const specDrift = (reviewer && reviewer.spec_drift) || 'none'

// Veredicto determinista (critic Step 11). La tabla original solapa en el tramo
// MAJOR (≥1 → NEEDS_CHANGES vs ≤2 → WITH_WARNINGS); se resuelve por precedencia
// y se declara aquí para que sea auditable. Es PROPUESTO: lo ratifica el humano.
let verdict = 'APPROVED'
let verdictReason = 'checks verdes, 0 BLOCKER, 0 MAJOR, todas las HUs cerradas'
if (findings_count.blocker > 0) {
  verdict = 'BLOCKED'
  verdictReason = `${findings_count.blocker} BLOCKER — el lifecycle se detiene hasta que el usuario decida`
} else if (checksRed.length > 0 || failed.length > 0 || blocked.length > 0 || findings_count.major > 2 || (security && security.findings.length > 0)) {
  verdict = 'NEEDS_CHANGES'
  verdictReason = [
    checksRed.length ? `checks en rojo: ${checksRed.map((c) => c.name).join(', ')}` : null,
    failed.length ? `HUs failed: ${failed.map((r) => r.id).join(', ')}` : null,
    blocked.length ? `HUs blocked: ${blocked.map((r) => r.id).join(', ')}` : null,
    findings_count.major > 2 ? `${findings_count.major} MAJOR` : null,
    security && security.findings.length ? 'findings de seguridad' : null,
  ].filter(Boolean).join(' · ')
} else if (findings_count.major > 0) {
  verdict = 'APPROVED_WITH_WARNINGS'
  verdictReason = `${findings_count.major} MAJOR sin bloqueo ni fallo de checks`
}
if (verdict !== 'BLOCKED' && ['scope_creep', 'skipped_ac'].includes(specDrift)) {
  verdict = 'NEEDS_CHANGES'
  verdictReason += `${verdictReason ? ' · ' : ''}spec_drift: ${specDrift}`
}

// ---------------------------------------------------------------------------
// Fase 4 — Synthesize: el artefacto de fase 4 se escribe desde el template.
// El writer NO decide el veredicto (ya viene calculado); redacta y ordena.
// ---------------------------------------------------------------------------
phase('Synthesize')

const digest = {
  slug,
  today: plan.today,
  review_level: level,
  review_level_reason: levelOverride ? `override explícito: ${levelOverride}` : plan.review_level_reason,
  oracle_source: plan.oracle_source,
  test_policy: plan.test_policy,
  spec_summary: plan.spec_summary,
  verdict,
  verdict_reason: verdictReason,
  findings_count,
  spec_drift: specDrift,
  spec_drift_note: (reviewer && reviewer.spec_drift_note) || '',
  sources: { fresh_reviewer: wantReviewer, quality: wantQuality, performance: wantPerf, security: wantSecurity },
  checks,
  diff_stat: (base && base.diff_stat) || '',
  per_hu: results,
  findings,
}

const WRITER_SCHEMA = {
  type: 'object',
  required: ['path', 'written', 'summary_line'],
  properties: { path: { type: 'string' }, written: { type: 'boolean' }, summary_line: { type: 'string' }, notes: { type: 'string' } },
}

const written = await agent(
  `Write the Phase 4 artifact of a /flow lifecycle. Read .claude/plans/templates/review.template.md and follow its structure and section order; extend the frontmatter as declared below. Write the file to ${PLAN}/review.md (overwrite if it exists). Write NOTHING else — ${NO_WRITE}\n\n` +
    `Frontmatter: spec: ${slug} · tasks_implemented: [${doneIdsLine}] · oracle_source: ${plan.oracle_source} · created: ${plan.today} · phase: 4 · status: draft · review_level: ${level} · verdict: ${verdict} · spec_drift: ${specDrift} · findings_count (blocker/major/minor/nit) · fresh_reviewer_invoked: ${wantReviewer ? 'yes' : 'no'} · security_review_invoked: ${wantSecurity ? 'yes' : 'no'} · review_patterns_modes: [${[wantQuality ? 'quality' : null, wantPerf ? 'performance' : null].filter(Boolean).join(', ')}] · generated_by: flow-cycle workflow.\n\n` +
    `Body rules:\n` +
    `- Veredicto: "${verdict}" — PROPUESTO por el workflow, pendiente de ratificación humana (\`flow-state verdict\`). Razón: ${verdictReason}.\n` +
    `- "Oracle ejecutado": one row per US from per_hu (oracle_evidence + check). Aggregate, never copy the oracle's content.\n` +
    `- Checklist of 5 sections: tick each item ONLY with evidence from the digest; an item without evidence stays unticked with "sin evidencia" — do not invent a check that nobody ran.\n` +
    `- Findings table: severity · description · file:line · recommendation, with the source in parentheses (fresh-reviewer / review-patterns:quality / review-patterns:performance / security-audit). Sort BLOCKER → NIT. Do NOT re-judge severities.\n` +
    `- "Living-spec deltas": only if spec_drift ≠ none; propose the patch, never apply it.\n` +
    `- HUs blocked/failed get their own short section with their exact question or error — these are what the Lead resolves with the user.\n` +
    `- Spanish (es-ES), same register as the template. No invented data: everything comes from the digest.\n\n` +
    `DIGEST (the single source of truth for this document):\n${JSON.stringify(digest)}\n\n` +
    `Return: path, written, summary_line (one line: verdict + findings + HUs), notes (anything in the digest that looked inconsistent).`,
  { label: 'synthesize:review.md', phase: 'Synthesize', schema: WRITER_SCHEMA, model: 'sonnet' },
)

// Boundary checks de /flow: se DEVUELVEN como datos; los registra el Lead con
// `flow-state boundary-check` (ningún agente escribe state.json).
const boundary_checks = [
  `phase-3: ${done.length}/${selected.length} HUs cerradas con oracle honrado (${plan.oracle_source})`,
  `phase-3: docs-sync intra-HU en ${done.filter((r) => r.docs_sync && r.docs_sync !== 'n/a').length}/${done.length} HUs`,
  `phase-4: base checks ejecutados (${checks.map((c) => `${c.name}:${c.ok ? 'ok' : 'red'}`).join(', ') || 'ninguno'})`,
  `phase-4: fresh reviewer ${wantReviewer ? 'invocado' : 'no aplica'} · security-audit ${wantSecurity ? 'invocado' : 'no aplica'} · review-patterns [${[wantQuality ? 'quality' : null, wantPerf ? 'performance' : null].filter(Boolean).join(', ') || 'ninguno'}]`,
  `phase-4: review.md ${written && written.written ? 'escrito' : 'NO escrito'} con veredicto propuesto ${verdict}`,
]

return {
  slug,
  review_level: level,
  verdict_proposed: verdict,
  verdict_reason: verdictReason,
  review_path: (written && written.path) || `${PLAN}/review.md`,
  review_written: !!(written && written.written),
  per_hu: results,
  done: done.map((r) => r.id),
  blocked: blocked.map((r) => ({ id: r.id, questions: r.questions || [] })),
  failed: failed.map((r) => ({ id: r.id, error: r.error })),
  retried: retriedCount,
  checks,
  findings_count,
  findings,
  spec_drift: specDrift,
  boundary_checks,
  // Inputs de la fase 5: datos, no artefacto — la retro la ratifica el humano.
  retro_inputs: {
    hu_questions: results.flatMap((r) => (r.questions || []).map((q) => `${r.id}: ${q}`)),
    out_of_scope_files: results.flatMap((r) => (r.out_of_scope_files || []).map((f) => `${r.id}: ${f}`)),
    retries: retriedCount,
    spec_drift: specDrift,
    spec_drift_note: (reviewer && reviewer.spec_drift_note) || '',
    writer_notes: (written && written.notes) || '',
  },
  next:
    `El Lead cierra con el usuario: 1) valida cada HU done y la cierra con \`bun .claude/scripts/flow-state.ts close-us US{N} --files "..."\`; ` +
    `2) registra los boundary_checks; 3) resuelve blocked/failed contigo (nunca improvisando la respuesta); ` +
    `4) ratifica o corrige el veredicto propuesto (\`flow-state verdict\`) — el workflow NO lo aprueba; 5) /retro con retro_inputs.`,
}
