export const meta = {
  name: 'ultracode-audit',
  description:
    'Audita el meta-sistema poneglyph con maxima paralelizacion + comunicacion inter-agente: pipeline find-verify por dominio (Four-Eyes), cross-debate sobre un digest compartido, plan-triage de HUs deferred, y sintesis a report.md + render HTML. Recomienda; no auto-muta.',
  phases: [
    { title: 'discover', detail: 'resolver args + dominios + seed (inline, sin spawn)' },
    { title: 'find-and-verify', detail: 'pipeline: finder (Explore) -> verifier adversarial por dominio' },
    { title: 'digest', detail: 'flatten + dedupe por dedupeKey + group (inline, single join)' },
    { title: 'cross-debate', detail: 'parallel barrier: cada agente reacciona al digest de los demas' },
    { title: 'plan-triage', detail: 'analizar planes open: por-HU execute|close|obsolete|leave' },
    { title: 'synthesize', detail: 'merge inline + writer agent -> report.md (+ html agent)' },
  ],
}

// ---------------------------------------------------------------------------
// Taxonomias reutilizadas (Commandment IX: no inventar) — severidad de `critic`,
// confianza de `anti-hallucination`/decision-stress-test.
// ---------------------------------------------------------------------------
const SEVERITY = ['BLOCKER', 'MAJOR', 'MINOR', 'NIT']
const CONFIDENCE = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']
const RECOMMENDATION = ['close', 'execute', 'obsolete', 'leave']

const FindingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['dedupeKey', 'domain', 'severity', 'file', 'description', 'fix', 'confidence'],
  properties: {
    dedupeKey: { type: 'string', description: 'identidad estable: `${file}:${line||0}:${claim-slug}`' },
    domain: { type: 'string' },
    severity: { enum: SEVERITY },
    file: { type: 'string' },
    line: { type: ['integer', 'null'] },
    description: { type: 'string' },
    fix: { type: 'string', description: 'remediacion concreta' },
    confidence: { enum: CONFIDENCE },
    isSeed: { type: 'boolean', description: 'true si confirma un hallazgo del seed (no nuevo)' },
  },
}

const FindingsArraySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: { findings: { type: 'array', items: FindingSchema } },
}

const VerifiedSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['finding', 'verdict'],
        properties: {
          finding: FindingSchema,
          verdict: {
            type: 'object',
            additionalProperties: false,
            required: ['isReal', 'reasoning'],
            properties: {
              isReal: { type: 'boolean' },
              reasoning: { type: 'string', description: 'fundamentado en Read/Grep/bun test' },
            },
          },
        },
      },
    },
  },
}

const DebateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['domain', 'dedupes', 'contradictions', 'escalations', 'downgrades', 'crossDomainNotes'],
  properties: {
    domain: { type: 'string' },
    dedupes: { type: 'array', items: { type: 'string' }, description: 'dedupeKeys que colapsan en otro dominio' },
    contradictions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['keyA', 'keyB', 'note'],
        properties: { keyA: { type: 'string' }, keyB: { type: 'string' }, note: { type: 'string' } },
      },
    },
    escalations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['keys', 'newSeverity', 'rationale'],
        properties: {
          keys: { type: 'array', items: { type: 'string' } },
          newSeverity: { enum: SEVERITY },
          rationale: { type: 'string' },
        },
      },
    },
    downgrades: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'reason'],
        properties: { key: { type: 'string' }, reason: { type: 'string' } },
      },
    },
    crossDomainNotes: { type: 'array', items: { type: 'string' } },
  },
}

const PlanTriageSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['plan', 'recommendation', 'evidence', 'confidence', 'perHU'],
  properties: {
    plan: { type: 'string' },
    recommendation: { enum: RECOMMENDATION },
    evidence: { type: 'string' },
    confidence: { enum: CONFIDENCE },
    perHU: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['hu', 'recommendation', 'evidence'],
        properties: {
          hu: { type: 'string' },
          recommendation: { enum: RECOMMENDATION },
          evidence: { type: 'string' },
        },
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Dominios finder. ≥4 => respeta el spawn-tree honestamente; tope 6 (no
// sobre-trocear corpus finos: hooks+tests = 1 unidad). Cada uno carga skills
// via Arch H (Read embebido) porque Skill() del Lead NO propaga a subagentes.
// ---------------------------------------------------------------------------
const DEFAULT_DOMAINS = [
  {
    key: 'plans-lifecycle',
    corpus: '.claude/plans/{001..010}-*/ (spec.md frontmatter, state.json, tasks/index.md, review.md, retro.md)',
    skills: ['anti-hallucination', 'retro'],
    focus:
      'Estado de ciclo de cada plan: status closed/open, feature_closed, HUs done vs pending vs deferred. ' +
      'Incoherencias entre state.json y frontmatter. Planes open que deberian cerrarse. NO marcar deferred como "hecho".',
  },
  {
    key: 'hooks-and-tests',
    corpus: '.claude/hooks/**/*.ts (skill-activation, security-gate, post-compact, workspace-hint, instructions-loaded) + __tests__/',
    skills: ['anti-hallucination', 'review-patterns'],
    focus:
      'Shebang issues (rules/paths/hooks.md: env bash roto en Windows), bugs, TODO/FIXME, refs a hooks eliminados ' +
      '(validate-tests-pass.ts), cobertura de tests. NO ejecutar tests; razonar sobre el codigo.',
  },
  {
    key: 'skills-and-commands',
    corpus: '.claude/skills/*/SKILL.md (20) + .claude/skills/*/references/** + .claude/commands/*.md (5)',
    skills: ['anti-hallucination', 'prompt-engineer'],
    focus:
      'Refs muertas a agentes cortados (builder/reviewer/scout/planner) en prosa de skills. Links references/ rotos. ' +
      'Keywords solapados entre skills. Refs a skills inexistentes. Excluir falsos positivos (Builder pattern de diseno, ' +
      'arquetipos parked templates/agent/*, nombres legacy de skill-roles).',
  },
  {
    key: 'rules-and-docs',
    corpus: '.claude/rules/** + .claude/docs/**',
    skills: ['anti-hallucination'],
    focus:
      'Stale references to private projects in core memory. Orphaned memories from retired agents. ' +
      'Refs a rules inexistentes. Contradicciones entre docs. Verificar si refs a hooks/phantoms ya estan etiquetadas como historicas.',
  },
  {
    key: 'claude-md-consistency',
    corpus: 'CLAUDE.md (raiz)',
    skills: ['anti-hallucination', 'meta-harness'],
    focus:
      'Inventario declarado (skills/hooks/commands/rules/agents counts) vs realidad. Drift de baseline de tests (numero hardcoded stale). ' +
      'Refs internas rotas. Contradicciones entre secciones. NO inventar claims; citar linea exacta.',
  },
  {
    key: 'version-claims',
    corpus: 'CLAUDE.md + cualquier doc con claims de version de Claude Code (CC >=2.1.x, GA, release notes)',
    skills: ['anti-hallucination'],
    focus:
      'Claims de version marcados "verify against release notes" sin resolver. Numeros de version inconsistentes entre ' +
      'ficheros. Marcar como SENSIBLE (requiere verificacion externa WebFetch; recomendar, no afirmar).',
  },
]

// ---------------------------------------------------------------------------
// Prompts (Arch H: cada uno embebe los Read de sus skills)
// ---------------------------------------------------------------------------
function archHReads(skills) {
  return skills.map((s) => `Read .claude/skills/${s}/SKILL.md`).join('\n  - ')
}

function findPrompt(domain, seed, index) {
  const seedForDomain = (seed || []).filter((s) => s.domain === domain.key)
  const seedBlock = seedForDomain.length
    ? 'HALLAZGOS SEMILLA (ya confirmados por una auditoria previa — CONFIRMA cada uno con isReal y marca isSeed:true; ' +
      'reporta ademas cualquier NUEVO):\n' +
      seedForDomain.map((s) => `  - [${s.severity}] ${s.file}${s.line ? ':' + s.line : ''} — ${s.description}`).join('\n')
    : 'No hay semilla para este dominio: barrido limpio.'
  return [
    `[RELEVANT SKILLS FOR THIS TASK] (Arch H — leelas antes de auditar):`,
    `  - ${archHReads(domain.skills)}`,
    ``,
    `Eres el FINDER del dominio "${domain.key}" (#${index}) en una auditoria del meta-sistema poneglyph.`,
    `Corpus a auditar: ${domain.corpus}`,
    `Foco: ${domain.focus}`,
    ``,
    seedBlock,
    ``,
    `Procedimiento: Read/Grep/Glob el corpus. Por cada problema real produce un Finding con:`,
    `dedupeKey ("\${file}:\${line||0}:\${claim-slug-kebab}"), domain="${domain.key}", severity (BLOCKER/MAJOR/MINOR/NIT),`,
    `file, line (o null), description, fix concreto, confidence (HIGH/MEDIUM/LOW/UNKNOWN), isSeed.`,
    `Reglas: cita file:line exacto (Commandment II — verifica antes de afirmar). NO inventes. Si dudas, confidence=LOW.`,
    `Excluye falsos positivos conocidos. Devuelve {findings:[...]} (vacio si todo limpio).`,
  ].join('\n')
}

function verifyPrompt(found, domain, index) {
  return [
    `[RELEVANT SKILLS FOR THIS TASK] (Arch H):`,
    `  - Read .claude/skills/anti-hallucination/SKILL.md`,
    `  - Read .claude/skills/critic/SKILL.md`,
    ``,
    `Eres el VERIFIER adversarial del dominio "${domain.key}" (Four-Eyes: validas el trabajo del finder).`,
    `Tu sesgo por defecto: ESCEPTICO. Un hallazgo solo sobrevive si lo confirmas leyendo la fuente.`,
    ``,
    `HALLAZGOS DEL FINDER a verificar:`,
    JSON.stringify(found, null, 2),
    ``,
    `Por cada hallazgo: Read/Grep el file:line citado. Decide verdict.isReal (true solo si el problema existe de verdad)`,
    `con reasoning fundamentado en lo que leiste. Si el finding esta mal atribuido, ya resuelto, o es un falso positivo`,
    `(ej. el ref ya esta etiquetado como historico/hipotetico), isReal=false con la evidencia. Ajusta severity si el`,
    `finder exagero. Devuelve {findings:[{finding, verdict}]} cubriendo TODOS los recibidos.`,
  ].join('\n')
}

function debatePrompt(domain, digest, index) {
  return [
    `[RELEVANT SKILLS FOR THIS TASK] (Arch H):`,
    `  - Read .claude/skills/decision-stress-test/SKILL.md`,
    `  - Read .claude/skills/anti-hallucination/SKILL.md`,
    ``,
    `Eres el agente de CROSS-DEBATE del dominio "${domain.key}". Recibes el DIGEST COMPARTIDO con los hallazgos`,
    `verificados de TODOS los dominios. Tu trabajo es la comunicacion inter-agente: reaccionar a los hallazgos de tus pares.`,
    ``,
    `DIGEST COMPARTIDO (todos los dominios):`,
    JSON.stringify(digest, null, 2),
    ``,
    `Desde la perspectiva de tu dominio, identifica:`,
    `- dedupes: dedupeKeys que son el MISMO problema visto por dos dominios (colapsar).`,
    `- contradictions: pares donde un dominio dice "X existe/roto" y otro "X esta bien/muerto" (keyA, keyB, note).`,
    `- escalations: 2+ findings MINOR en dominios distintos que juntos son un problema sistemico MAJOR (keys, newSeverity, rationale).`,
    `- downgrades: findings que otro dominio probo benignos (key, reason).`,
    `- crossDomainNotes: patrones que cruzan dominios.`,
    `Devuelve el objeto completo (arrays vacios si no aplica). No re-audites; razona sobre el digest dado.`,
  ].join('\n')
}

function triagePrompt(plan, digest, index) {
  return [
    `[RELEVANT SKILLS FOR THIS TASK] (Arch H):`,
    `  - Read .claude/skills/retro/SKILL.md`,
    `  - Read .claude/skills/drillme/SKILL.md`,
    `  - Read .claude/skills/anti-hallucination/SKILL.md`,
    ``,
    `Eres el agente de PLAN-TRIAGE para el plan "${plan}".`,
    `Lee: .claude/plans/${plan}/state.json, .claude/plans/${plan}/tasks/index.md, y los tasks/US*.md de las HUs pendientes.`,
    ``,
    `Para cada HU pendiente/deferred decide recommendation: execute (vale la pena hacerla), close (cerrar won't-do con razon),`,
    `obsolete (ya no aplica), o leave (dejar open). Criterio: coste vs valor (Commandment V simplicidad + IX mantenibilidad).`,
    `Refs muertas a agentes cortados = trabajo barato de alto valor => normalmente execute o close, nunca leave indefinido.`,
    `Cruza con el DIGEST si hay hallazgos que solapan con el trabajo deferred:`,
    JSON.stringify(digest && digest.byDomain ? { byDomain: Object.keys(digest.byDomain), total: digest.total } : {}, null, 2),
    ``,
    `Devuelve {plan, recommendation (global), evidence, confidence, perHU:[{hu, recommendation, evidence}]}.`,
    `Recomienda; NO ejecutes ni edites nada (el humano decide via hard gate).`,
  ].join('\n')
}

function reportPrompt(merged, stamp, slug, reportPath) {
  return [
    `[RELEVANT SKILLS FOR THIS TASK] (Arch H):`,
    `  - Read .claude/skills/critic/SKILL.md`,
    `  - Read .claude/skills/retro/SKILL.md`,
    ``,
    `Eres el WRITER de sintesis. Tienes el resultado mergeado de la auditoria (findings verificados + reacciones de`,
    `cross-debate + plan-triage). Escribe un report.md en estilo poneglyph (terso, tablas, Mermaid si aporta).`,
    ``,
    `DATOS MERGEADOS:`,
    JSON.stringify(merged, null, 2),
    ``,
    `Write el fichero exactamente en: ${reportPath}`,
    `Estructura obligatoria:`,
    `1. Frontmatter YAML: id: ${slug}, date: ${stamp}, method: ultracode-audit workflow, verdict.`,
    `2. Veredicto ejecutivo (1-3 lineas).`,
    `3. Findings confirmados por severidad (tabla: sev | file:line | desc | fix | confidence).`,
    `4. Contradicciones / escalados / dedupes del cross-debate (lo que demuestra la comunicacion inter-agente).`,
    `5. Tabla de decisiones de plan (plan | HU | recommendation | evidence).`,
    `6. Acciones recomendadas (human-gated) — separa seguras vs sensibles.`,
    `7. Apendice: hallazgos semilla re-confirmados vs nuevos (para repetibilidad).`,
    `Tu texto final = solo una confirmacion corta de que escribiste el fichero y cuantos findings/decisiones contiene.`,
  ].join('\n')
}

function htmlPrompt(reportPath, slug) {
  return [
    `[RELEVANT SKILLS FOR THIS TASK] (Arch H):`,
    `  - Read .claude/skills/html-report/SKILL.md`,
    ``,
    `Eres el RENDERER. Read ${reportPath} y renderiza un HTML self-contained (dashboard) siguiendo el skill html-report`,
    `(template dashboard, dark/light, near-zero deps). Write el resultado en .claude/plans/${slug}/report.html.`,
    `Respeta WCAG contrast y evita AI-slop tells (el skill tiene el corpus de taste + la auto-critica).`,
    `Tu texto final = confirmacion corta de que escribiste report.html.`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Helpers puros (sin Date.now/Math.random — romperian resume)
// ---------------------------------------------------------------------------
function dedupeAndGroup(findings) {
  const byKey = {}
  for (const f of findings) {
    if (!f || !f.dedupeKey) continue
    // primera aparicion gana; si reaparece con mayor severidad, sube
    const prev = byKey[f.dedupeKey]
    if (!prev || SEVERITY.indexOf(f.severity) < SEVERITY.indexOf(prev.severity)) {
      byKey[f.dedupeKey] = f
    }
  }
  const unique = Object.keys(byKey).map((k) => byKey[k])
  const byDomain = {}
  const bySeverity = {}
  for (const f of unique) {
    ;(byDomain[f.domain] = byDomain[f.domain] || []).push(f.dedupeKey)
    ;(bySeverity[f.severity] = bySeverity[f.severity] || []).push(f.dedupeKey)
  }
  return { total: unique.length, findings: unique, byDomain, bySeverity, dedupeKeys: Object.keys(byKey) }
}

function mergeAll(digest, reactions, triage, stamp, seed) {
  // aplica escalados/downgrades del cross-debate sobre el digest
  const findingsByKey = {}
  for (const f of digest.findings) findingsByKey[f.dedupeKey] = Object.assign({}, f)
  const droppedKeys = {}
  for (const r of reactions || []) {
    if (!r) continue
    for (const e of r.escalations || []) {
      for (const k of e.keys || []) {
        if (findingsByKey[k]) {
          findingsByKey[k].severity = e.newSeverity
          findingsByKey[k].escalatedBy = r.domain
        }
      }
    }
    for (const d of r.downgrades || []) {
      if (findingsByKey[d.key]) findingsByKey[d.key].downgradeNote = d.reason
    }
    for (const dk of r.dedupes || []) {
      // marca como dedup (no se borra, se anota para transparencia)
      if (findingsByKey[dk]) findingsByKey[dk].dedupedBy = r.domain
    }
  }
  const finalFindings = Object.keys(findingsByKey).map((k) => findingsByKey[k])
  const seedKeys = new Set((seed || []).map((s) => s.file + ':' + (s.line || 0)))
  const reconfirmed = finalFindings.filter((f) => f.isSeed)
  const fresh = finalFindings.filter((f) => !f.isSeed)
  const contradictions = []
  for (const r of reactions || []) for (const c of r.contradictions || []) contradictions.push(Object.assign({ from: r.domain }, c))
  return {
    stamp,
    summary: {
      totalFindings: finalFindings.length,
      reconfirmedFromSeed: reconfirmed.length,
      newFindings: fresh.length,
      contradictions: contradictions.length,
      plansTriaged: (triage || []).length,
    },
    bySeverity: digest.bySeverity,
    findings: finalFindings,
    contradictions,
    crossDomainNotes: (reactions || []).flatMap((r) => (r ? r.crossDomainNotes || [] : [])),
    planDecisions: triage || [],
  }
}

// ===========================================================================
// CUERPO (async top-level)
// ===========================================================================
phase('discover')
// KNOWN (run wf_68a7a476, 2026-06-09): args.knownFindings + args.decisionPlans
// threaded correctly but args.stampDate resolved falsy -> 'unknown-date' in the
// report frontmatter. Other args keys work, so this is a stamp-specific quirk to
// re-check; the writer/Lead can stamp the date post-run. Not deep-debugged.
const stamp = (args && args.stampDate) || 'unknown-date'
const domains = (args && args.domains) || DEFAULT_DOMAINS
const decisionPlans = (args && args.decisionPlans) || [] // no default plan — 008 archived (028/US6); pass live slugs via args
const seed = (args && args.knownFindings) || []
const renderHtml = !!(args && args.renderHtml)
const auditSlug = (args && args.auditSlug) || 'ultracode-audit'
log(`ultracode-audit: ${domains.length} dominios, ${decisionPlans.length} plan(es) en triage, stamp ${stamp}`)

phase('find-and-verify')
// PIPELINE = forward-passing sin barrera: el verifier de un dominio rapido
// arranca mientras otro dominio aun busca. P7: generator->validator intra-workflow
// NO es una nueva decision de spawn.
const verifiedByDomain = await pipeline(
  domains,
  async (domain, _orig, i) => {
    const out = await agent(findPrompt(domain, seed, i), {
      label: `find:${domain.key}`,
      phase: 'find-and-verify',
      schema: FindingsArraySchema,
      agentType: 'Explore',
    })
    return { key: domain.key, findings: out && out.findings ? out.findings : [] }
  },
  async (found, domain, i) => {
    if (!found || !found.findings.length) return { key: domain.key, verified: [] }
    const v = await agent(verifyPrompt(found.findings, domain, i), {
      label: `verify:${domain.key}`,
      phase: 'find-and-verify',
      schema: VerifiedSchema,
      model: 'sonnet',
    })
    return { key: domain.key, verified: v && v.findings ? v.findings : [] }
  }
)

phase('digest')
// Unico join sincronico (inline, sin primitiva de barrera): aplana, filtra isReal, dedupe.
const allReal = (verifiedByDomain || [])
  .filter(Boolean)
  .flatMap((d) => (d.verified || []).filter((vf) => vf && vf.verdict && vf.verdict.isReal).map((vf) => vf.finding))
const digest = dedupeAndGroup(allReal)
log(`digest: ${digest.total} findings reales en ${Object.keys(digest.byDomain).length} dominios`)

phase('cross-debate')
// PARALLEL = barrera intrinseca: cada agente necesita el digest COMPLETO de sus pares.
const reactions = (
  await parallel(
    domains.map((domain, i) => () =>
      agent(debatePrompt(domain, digest, i), {
        label: `debate:${domain.key}`,
        phase: 'cross-debate',
        schema: DebateSchema,
        model: 'sonnet',
      })
    )
  )
).filter(Boolean)

phase('plan-triage')
const triage = (
  await parallel(
    decisionPlans.map((plan, i) => () =>
      agent(triagePrompt(plan, digest, i), {
        label: `triage:${plan}`,
        phase: 'plan-triage',
        schema: PlanTriageSchema,
      })
    )
  )
).filter(Boolean)

phase('synthesize')
const merged = mergeAll(digest, reactions, triage, stamp, seed)
const reportPath = `.claude/plans/${auditSlug}/report.md`
await agent(reportPrompt(merged, stamp, auditSlug, reportPath), {
  label: 'synthesize:report',
  phase: 'synthesize',
})
if (renderHtml) {
  await agent(htmlPrompt(reportPath, auditSlug), {
    label: 'synthesize:html',
    phase: 'synthesize',
  })
}
log(`ultracode-audit done: ${merged.summary.totalFindings} findings, ${merged.summary.plansTriaged} plan(es) triaged`)
return merged
