export const meta = {
  name: 'sssf',
  description:
    'Software factory autónoma para UNA tarea one-shot sin plan previo: plan → build → gate → review → document, con gates DETERMINISTAS (.claude/scripts/gate.ts) en cada frontera en vez de gates humanos. El código decide si una fase pasó; el agente solo propone. No commitea: devuelve suggested_commits como dato.',
  whenToUse:
    'Tarea acotada que hoy harías a mano porque montar un lifecycle /flow es desproporcionado, y quieres que el resultado quede verificado por código y no por la palabra del agente. Para features usa /flow (gates humanos); esto NO es /flow sin gates.',
  phases: [
    { title: 'Request', detail: 'runId + check command + baseline del árbol (1 agente barato)' },
    { title: 'Plan', detail: 'convertir la petición en un plan implementable', model: 'opus' },
    { title: 'Build', detail: 'implementar el plan; bucle de reparación acotado por gate', model: 'sonnet' },
    { title: 'Review', detail: 'confirmar que lo construido es lo pedido', model: 'opus' },
    { title: 'Document', detail: 'escribir el cambio desde el diff medido', model: 'sonnet' },
  ],
}

// args: { task, commit?: false, runId?, checkCommand? }
// El script NO toca disco (los workflows no tienen filesystem ni shell): todo I/O pasa
// por agentes. El DETERMINISMO no vive aquí, vive en .claude/scripts/gate.ts — código
// TypeScript real, cubierto por `bun test ./.claude/scripts/`. Este script solo decide
// el control flow a partir del veredicto que gate.ts calcula. Agent proposes, code disposes.
//
// Doctrina de modelos (029/US9): unidades en sonnet; opus solo con razón declarada;
// NUNCA el modelo de sesión en unidades.
const task = typeof args === 'string' ? args : args?.task
if (!task) throw new Error('sssf necesita args.task (p.ej. {"task":"añade un endpoint /health"})')

const COMMIT = args?.commit === true
const MAX_FIX = 3
const MAX_REVISION = 2

// ---------- Phase 1: Request (barato: identidad del run + baseline) ----------
phase('Request')

const REQUEST_SCHEMA = {
  type: 'object',
  required: ['run_id', 'session_dir', 'check_command', 'baseline_path', 'head'],
  properties: {
    run_id: { type: 'string' },
    session_dir: { type: 'string' },
    check_command: { type: 'string' },
    baseline_path: { type: 'string' },
    head: { type: 'string' },
    completed_phases: { type: 'array', items: { type: 'string' } },
  },
}

// El script no puede llamar a Date.now() (rompería el resume), así que la identidad del
// run la trae el agente. args.runId tiene precedencia: reanudar = pasar el mismo runId
// y dejar que este agente informe de qué envelopes ya existen.
const run = await agent(
  `Set up an sssf run. Do exactly this and return the structured object:\n` +
    `1) run_id: ${args?.runId ? `use EXACTLY "${args.runId}"` : 'run `date +%Y%m%dT%H%M%S` and append "-" plus `git rev-parse --short HEAD`'}.\n` +
    `2) session_dir: /tmp/sssf/<run_id> — create it with mkdir -p. It MUST live OUTSIDE the repo: envelopes written inside the repo would show up as untracked changes and poison the very gate that reads them.\n` +
    `3) check_command: the project's verification command. Look in package.json scripts.test, then the project CLAUDE.md verification section, then .claude/rules/test-policy.md.${args?.checkCommand ? ` The caller supplied "${args.checkCommand}" — prefer it.` : ''}\n` +
    `   VERIFY it by running it: it must exit 0 AND report more than 0 tests. A command that finds no tests turns every gate in this run red — and that failure is silent unless you check now. (Concrete trap: bare \`bun test\` skips dot-directories, so in a repo whose tests live under .claude/ it finds zero; the real command names the path.)\n` +
    `4) baseline_path: <session_dir>/baseline.json — produce it by running: bun .claude/scripts/gate.ts baseline --out <session_dir>/baseline.json\n` +
    `5) head: \`git rev-parse --short HEAD\`.\n` +
    `6) completed_phases: names of phases whose envelope already exists in session_dir (plan.json, build.json, review.json). Empty array on a fresh run.\n` +
    `Change NOTHING else in the repo.`,
  { label: 'request:setup', phase: 'Request', schema: REQUEST_SCHEMA, model: 'sonnet', effort: 'low' },
)

if (!run) return { aborted: true, reason: 'el agente de request falló — sin baseline no hay gate posible' }
log(`run ${run.run_id} · check: ${run.check_command} · baseline: ${run.baseline_path}`)

// ---------- El gate: una llamada por frontera, no una por check ----------
const GATE_SCHEMA = {
  type: 'object',
  required: ['passed', 'exit_code', 'violations'],
  properties: {
    passed: { type: 'boolean' },
    exit_code: { type: 'number' },
    violations: { type: 'array', items: { type: 'string' } },
    checks_run: { type: 'number' },
  },
}

/**
 * Corre gate.ts sobre el envelope de una fase.
 *
 * El agente-gate es un LLM entre el código y el resultado, así que NO hay garantía
 * criptográfica: un hash sobre el stdout que el propio agente suministra casa con la
 * falsificación. Lo que sí se hace es (a) tratar su juicio como advisory y decidir por
 * exit_code, (b) tratar la DISCREPANCIA entre passed y exit_code como fallo duro —
 * es la firma del agente "servicial" —, y (c) fail-closed si el agente muere.
 */
async function runGate(phaseName, envelope, opts = {}) {
  const file = `${run.session_dir}/${phaseName}.json`
  const flags = [`--phase ${phaseName}`, `--envelope ${file}`, `--ignore ${run.session_dir}`]
  // baseline: null = no diff cross-check. The retest asks "does it still run", not
  // "did you touch what you claimed" — passing a baseline taken AFTER the work would
  // yield an empty delta and mark every claimed file as never-touched.
  if (opts.baseline !== null) flags.push(`--baseline ${opts.baseline || run.baseline_path}`)
  if (opts.withSuite) flags.push(`--check-command ${JSON.stringify(run.check_command)}`)

  const res = await agent(
    `Run one deterministic gate. Do NOT judge the work yourself and do NOT fix anything.\n` +
      `1) Write this JSON verbatim to ${file}:\n${JSON.stringify(envelope)}\n` +
      `2) Run: bun .claude/scripts/gate.ts check ${flags.join(' ')}\n` +
      `3) The command prints ONE line of JSON and exits 0 (passed) or 1 (failed). Return: passed and violations copied VERBATIM from that JSON, exit_code = the process's real exit code, checks_run = the length of its checks array.\n` +
      `Report the command's output faithfully even when it fails — reporting a pass it did not give is the one failure this step cannot tolerate.`,
    { label: `gate:${phaseName}`, phase: opts.uiPhase || 'Build', schema: GATE_SCHEMA, model: 'haiku', effort: 'low' },
  )

  if (!res) return { passed: false, exit_code: -1, violations: ['el agente-gate murió — fail-closed'] }
  // Redundancia cruzada: dos campos reportados de forma independiente que no cuadran.
  if (res.passed !== (res.exit_code === 0)) {
    return { passed: false, exit_code: res.exit_code, violations: [`el agente-gate se contradice: passed=${res.passed} con exit_code=${res.exit_code}`, ...(res.violations || [])] }
  }
  return res
}

/** Normaliza un fallo para comparar iteraciones (mismo patrón que flow-cycle.js:174). */
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 300)
const signature = (violations) => (violations || []).map(norm).sort().join(' | ')

/**
 * Coherencia de veredicto, INLINE: es una función pura sobre un envelope que el script
 * ya tiene en memoria, así que no cruza el transporte LLM y no se puede falsear.
 * gate.ts tiene la versión completa para su CLI; esto es el guard de 3 condiciones que
 * el control flow necesita aquí y ahora.
 */
function verdictCoherent(env) {
  if (!env) return { ok: false, why: 'el reviewer no devolvió envelope' }
  const blocking = env.blocking || []
  const unmet = (env.findings || []).filter((f) => !f.met)
  if (env.approved && blocking.length > 0) return { ok: false, why: `approved=true con ${blocking.length} blocking item(s)` }
  if (env.approved && unmet.length > 0) return { ok: false, why: `approved=true con ${unmet.length} requisito(s) sin cumplir` }
  if (!env.approved && blocking.length === 0 && unmet.length === 0) return { ok: false, why: 'approved=false sin nombrar ningún problema' }
  return { ok: true, why: 'el veredicto concuerda con sus propios findings' }
}

// ---------- Phase 2: Plan ----------
phase('Plan')

const PLAN_SCHEMA = {
  type: 'object',
  required: ['summary', 'artifacts', 'steps', 'commit_message'],
  properties: {
    summary: { type: 'string' },
    artifacts: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    acceptance: { type: 'array', items: { type: 'string' } },
    commit_message: { type: 'string' },
  },
}

// opus con razón: el plan gobierna todo lo que viene después; un plan flojo lo pagan
// las tres fases siguientes y ningún gate mecánico puede rescatarlo.
const plan = await agent(
  `You are the PLANNER of an autonomous run. Turn this request into a plan the builder can implement without asking questions.\n\n` +
    `REQUEST: ${task}\n\n` +
    `First understand what exists: search the repo for code that already does this or something close to it — reuse beats writing new. Then write the plan to ${run.session_dir}/plan.md.\n` +
    `The plan names: the files to touch, the key signatures, the order, and the acceptance criteria as falsifiable statements.\n` +
    `Write NOTHING inside the repo — the plan file lives in the session dir. Do NOT implement anything. Do NOT git commit.\n` +
    `Return: summary, artifacts (paths you wrote — at minimum ${run.session_dir}/plan.md), steps, acceptance, commit_message (one line describing the SPEC, in the words of this agent).`,
  { label: 'plan', phase: 'Plan', schema: PLAN_SCHEMA, model: 'opus' },
)

if (!plan) return { aborted: true, reason: 'el planner falló', run_id: run.run_id }

const planGate = await runGate('plan', { artifacts: plan.artifacts, files_touched: [] }, { uiPhase: 'Plan' })
if (!planGate.passed) {
  return { aborted: true, reason: 'el plan no pasó su gate', violations: planGate.violations, run_id: run.run_id }
}

// ---------- Phase 3: Build + bucle de reparación acotado ----------
phase('Build')

const BUILD_SCHEMA = {
  type: 'object',
  required: ['status', 'summary', 'files_touched', 'commit_message'],
  properties: {
    status: { enum: ['done', 'blocked', 'failed'] },
    summary: { type: 'string' },
    files_touched: { type: 'array', items: { type: 'string' } },
    commit_message: { type: 'string' },
    question: { type: 'string' },
  },
}

function buildPrompt(previousViolations) {
  const base =
    `You are the BUILDER. Implement the plan at ${run.session_dir}/plan.md EXACTLY.\n\n` +
    `ORIGINAL REQUEST: ${task}\nPLAN SUMMARY: ${plan.summary}\nSTEPS:\n${(plan.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n` +
    `Follow the surrounding code style. Smallest diff that satisfies the plan.\n` +
    `Report EVERY file you changed in files_touched — a deterministic gate cross-checks your list against the real git delta, so an omission fails the phase just like an invention does.\n` +
    `Do NOT git commit or push. Do NOT edit .claude/scripts/gate.ts or .claude/workflows/sssf.js — a builder that edits its own grader invalidates the run.\n` +
    `If the plan is ambiguous and you would have to GUESS: do not improvise — return status:"blocked" with the exact question.\n` +
    `Return: status, summary, files_touched, commit_message (one line describing the CODE, your own words), question (only if blocked).`
  if (!previousViolations) return base
  return (
    base +
    `\n\nA PREVIOUS ATTEMPT FAILED ITS GATE. Fix the ROOT CAUSE of these violations, verbatim from the gate:\n` +
    previousViolations.map((v) => `- ${v}`).join('\n') +
    `\nDo not paper over them and do not re-report the same work as done.`
  )
}

let build = null
let buildGate = null
let lastSignature = null
let fixAttempts = 0

for (let i = 1; i <= MAX_FIX; i++) {
  build = await agent(buildPrompt(i === 1 ? null : buildGate.violations), {
    label: i === 1 ? 'build' : `fix:${i - 1}`,
    phase: 'Build',
    schema: BUILD_SCHEMA,
    model: 'sonnet',
  })
  if (!build) return { aborted: true, reason: 'el builder murió', run_id: run.run_id }
  if (build.status === 'blocked') {
    return { aborted: true, reason: 'el builder necesita una respuesta humana', question: build.question, run_id: run.run_id }
  }
  fixAttempts = i - 1

  buildGate = await runGate('build', { status: build.status, files_touched: build.files_touched }, { withSuite: true })
  if (buildGate.passed) break

  const sig = signature(buildGate.violations)
  // Identical-error override (rules/error-recovery.md): un reintento que reproduce el
  // MISMO fallo no progresa; gastar el presupuesto restante en él es repetir más alto.
  if (sig === lastSignature) {
    log(`el gate falla con las mismas violaciones dos veces — corto el bucle en la iteración ${i}`)
    break
  }
  lastSignature = sig
  if (i < MAX_FIX) log(`gate rojo (intento ${i}/${MAX_FIX}): ${buildGate.violations.length} violación(es) → reparación`)
}

const buildVerified = Boolean(buildGate && buildGate.passed)

// ---------- Phase 4: Review + revisión acotada ----------
phase('Review')

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['approved', 'summary', 'blocking', 'findings'],
  properties: {
    approved: { type: 'boolean' },
    summary: { type: 'string' },
    blocking: { type: 'array', items: { type: 'string' } },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['requirement', 'met', 'evidence'],
        properties: { requirement: { type: 'string' }, met: { type: 'boolean' }, evidence: { type: 'string' }, severity: { enum: ['BLOCKER', 'MAJOR', 'MINOR', 'NIT'] } },
      },
    },
  },
}

// opus con razón: es el juicio de correctness contra la petición original, y su valor
// ES el contexto fresco. La suite ya respondió "¿corre?"; esto responde "¿es lo pedido?"
// — dos preguntas distintas que ninguna de las dos puede contestar por la otra.
const reviewPrompt =
  `You are a FRESH-CONTEXT REVIEWER, read-only. Change nothing; you may not fix what you find.\n\n` +
  `ORIGINAL REQUEST: ${task}\n` +
  `Read the plan at ${run.session_dir}/plan.md, then read the actual diff (\`git diff ${run.head} --stat\`, then the relevant files).\n` +
  `Trace EACH acceptance criterion to the diff. Ask only: is what was built what was asked for?\n` +
  `Flag: an AC with no implementation, an implementation contradicting an AC, a broken happy path.\n` +
  `Your verdict must agree with your own findings — a deterministic check refutes an approval that ships blocking items, without reading a line of the diff.\n` +
  `Return: approved, summary, blocking (empty when approved), findings [{requirement, met, evidence (file:line), severity}].`

let review = null
let revisions = 0
let reviseGate = null
let coherence = { ok: false, why: 'sin review' }

for (let i = 1; i <= MAX_REVISION; i++) {
  review = await agent(i === 1 ? reviewPrompt : `${reviewPrompt}\n\nNOTE: this is re-review ${i}; the builder has since addressed the previous blocking items. Judge the CURRENT state of the tree.`, {
    label: i === 1 ? 'review' : `re-review:${i}`,
    phase: 'Review',
    schema: REVIEW_SCHEMA,
    model: 'opus',
  })

  coherence = verdictCoherent(review)
  if (!coherence.ok) {
    log(`veredicto incoherente refutado sin leer el diff: ${coherence.why}`)
    break
  }
  if (review.approved || i === MAX_REVISION) break

  // Re-baseline ANTES de revisar: así el delta que se le imputa al fixer contiene SOLO
  // su trabajo. Con el baseline original, todo lo que hizo el builder — ya validado por
  // su propio gate — contaría como cambio no declarado del fixer.
  const rebase = await agent(
    `Run: bun .claude/scripts/gate.ts baseline --out ${run.session_dir}/baseline-rev${i}.json — then return the path. Change nothing else.`,
    { label: `re-baseline:${i}`, phase: 'Review', schema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } }, model: 'haiku', effort: 'low' },
  )
  if (rebase && rebase.path) run.baseline_path = rebase.path

  const revise = await agent(
    `You are the BUILDER. Close ONLY these blocking findings from the reviewer:\n` +
      (review.blocking || []).map((b) => `- ${b}`).join('\n') +
      `\n\nUnmet requirements:\n` +
      (review.findings || []).filter((f) => !f.met).map((f) => `- ${f.requirement} (${f.evidence})`).join('\n') +
      `\n\nSmallest diff that closes them. Report every file you touch — the same deterministic gate cross-checks your list. Do NOT git commit. Do NOT touch the gate or this workflow.`,
    { label: `revise:${i}`, phase: 'Review', schema: BUILD_SCHEMA, model: 'sonnet' },
  )
  if (!revise) break
  revisions = i
  build = { ...build, files_touched: [...new Set([...(build.files_touched || []), ...(revise.files_touched || [])])] }

  // El fixer rinde las mismas cuentas que el builder: sin esto, el re-baseline no
  // tendría consumidor y una revisión sería la vía por la que entra trabajo sin medir.
  reviseGate = await runGate(`revise${i}`, { status: revise.status, files_touched: revise.files_touched }, { uiPhase: 'Review' })
  if (!reviseGate.passed) {
    log(`la revisión no pasó su gate: ${reviseGate.violations.join(' · ')}`)
    break
  }
}

// La suite corrió antes de la revisión, así que un verde previo está caducado. Esto
// pregunta SOLO "¿sigue corriendo?" — el diff ya lo verificó el gate de la revisión —,
// de ahí baseline: null.
let retest = null
if (revisions > 0 && review && review.approved && coherence.ok) {
  retest = await runGate('retest', { status: 'done', files_touched: build.files_touched }, { withSuite: true, baseline: null, uiPhase: 'Review' })
}

const verified =
  buildVerified &&
  Boolean(review && review.approved) &&
  coherence.ok &&
  (reviseGate === null || reviseGate.passed) &&
  (retest === null || retest.passed)

// ---------- Phase 5: Document (solo sobre trabajo verificado) ----------
phase('Document')

let document = null
if (verified) {
  document = await agent(
    `You are the DOCUMENTER. Write up the change that was just made, from the DIFF — not from the plan, which describes intent rather than outcome.\n` +
      `Read \`git diff ${run.head}\` in full first. Document only what the diff shows.\n` +
      `ORIGINAL REQUEST: ${task}\n` +
      `Write the note to ${run.session_dir}/document.md. Do NOT modify source files and do NOT git commit.\n` +
      `Return: summary, artifacts, commit_message (one line describing the WRITE-UP, your own words).`,
    { label: 'document', phase: 'Document', schema: PLAN_SCHEMA, model: 'sonnet' },
  )
} else {
  log('no verificado: no se documenta — no hay nada que merezca descripción todavía')
}

// ---------- Handback: el humano decide qué se commitea ----------
// Cero commits por defecto, por dos razones y la segunda es la que manda:
// (a) CLAUDE.md §Git discipline — commits solo si se piden en el turno, y aprobar el
//     lanzamiento del Workflow no es aprobar tres commits dentro;
// (b) mecánica: commitear entre fases vacía `git diff --name-only` y DESTRUYE el input
//     del propio gate. Commits automáticos y diff_matches_claims son incompatibles.
const suggestedCommits = [
  plan && { phase: 'plan', files: plan.artifacts || [], message: plan.commit_message },
  verified && build && { phase: 'build', files: build.files_touched || [], message: build.commit_message },
  verified && document && { phase: 'docs', files: document.artifacts || [], message: document.commit_message },
].filter(Boolean)

return {
  run_id: run.run_id,
  session_dir: run.session_dir,
  verified,
  task,
  plan: plan ? { summary: plan.summary, artifacts: plan.artifacts } : null,
  build: build ? { status: build.status, summary: build.summary, files_touched: build.files_touched } : null,
  gate: {
    build: buildGate ? { passed: buildGate.passed, violations: buildGate.violations } : null,
    revise: reviseGate ? { passed: reviseGate.passed, violations: reviseGate.violations } : null,
    retest: retest ? { passed: retest.passed, violations: retest.violations } : null,
    fix_attempts: fixAttempts,
    revisions,
  },
  review: review ? { approved: review.approved, summary: review.summary, blocking: review.blocking, findings: review.findings } : null,
  verdict_coherence: coherence,
  document: document ? { summary: document.summary, artifacts: document.artifacts } : null,
  suggested_commits: suggestedCommits,
  commit_requested: COMMIT,
  next: verified
    ? `Verificado por gate.ts (no por la palabra del agente). El Lead revisa el diff y decide los commits${COMMIT ? ' — pediste commit:true, pero este workflow no commitea: aplica suggested_commits tú' : ''}.`
    : `NO verificado — el árbol queda sucio a propósito para que lo veas. Revisa gate.violations y review.blocking; el plan en ${run.session_dir}/plan.md sigue siendo un artefacto válido.`,
}
