let meta = #{
    name: "limpieza",
    description: "Full cleanup audit of AI config and code: bugs, dead code, stale refs, temporary/session data, and valueless content. Produces an actionable findings list (where, why, action) without forcing or undervaluing issues.",
    when_to_use: "When you want a thorough cleanup list for the poneglyph/.claude layer (or any scoped root): dead weight, broken refs, session-specific cruft, and real bugs — before a prune pass.",
    phases: [
        #{ title: "Discover", detail: "resolve root/scope and domain list" },
        #{ title: "Scan", detail: "parallel domain finders (read-only)" },
        #{ title: "Verify", detail: "adversarial skeptic per finding (fail closed)" },
        #{ title: "Synthesize", detail: "dedupe + ranked report.md" },
    ],
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
let finding_item = #{
    "type": "object",
    "required": ["category", "severity", "file", "where", "why", "action", "evidence", "confidence"],
    "properties": #{
        "category": #{
            "type": "string",
            "description": "bug | dead_code | stale_ref | config_purity | valueless | contradiction | other",
        },
        "severity": #{
            "type": "string",
            "description": "BLOCKER | MAJOR | MINOR | NIT",
        },
        "file": #{ "type": "string", "description": "repo-relative path" },
        "line": #{ "type": ["integer", "null"] },
        "where": #{
            "type": "string",
            "description": "precise location: path + symbol/section + what is wrong there",
        },
        "why": #{
            "type": "string",
            "description": "why this exists / root cause / class of failure",
        },
        "action": #{
            "type": "string",
            "description": "concrete next step: delete | rewrite | move | verify | leave-with-reason",
        },
        "evidence": #{
            "type": "string",
            "description": "what you read (file:line, grep hit, missing file) — not memory",
        },
        "confidence": #{
            "type": "string",
            "description": "HIGH | MEDIUM | LOW",
        },
    },
};

let findings_schema = #{
    "type": "object",
    "required": ["findings", "scope_covered"],
    "properties": #{
        "findings": #{
            "type": "array",
            "maxItems": 30,
            "items": finding_item,
        },
        "scope_covered": #{
            "type": "string",
            "description": "short note of what was actually inspected (paths, counts)",
        },
    },
};

let verdict_schema = #{
    "type": "object",
    "required": ["real", "reason", "evidence", "severity_adjusted"],
    "properties": #{
        "real": #{ "type": "boolean" },
        "reason": #{ "type": "string" },
        "evidence": #{ "type": "string" },
        "severity_adjusted": #{
            "type": "string",
            "description": "BLOCKER | MAJOR | MINOR | NIT — same or corrected; empty if not real",
        },
        "action_adjusted": #{
            "type": "string",
            "description": "optional refined action if the finding is real",
        },
    },
};

let report_schema = #{
    "type": "object",
    "required": ["title", "summary", "body_markdown"],
    "properties": #{
        "title": #{ "type": "string" },
        "summary": #{ "type": "string" },
        "body_markdown": #{ "type": "string" },
        "stats": #{
            "type": "object",
            "properties": #{
                "confirmed": #{ "type": "integer" },
                "rejected": #{ "type": "integer" },
                "unverified": #{ "type": "integer" },
            },
        },
    },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
fn trimmed(s) {
    if type_of(s) == "string" {
        s.trim();
        s
    } else {
        ""
    }
}

fn severity_rank(s) {
    if s == "BLOCKER" { 0 } else if s == "MAJOR" { 1 } else if s == "MINOR" { 2 } else { 3 }
}

fn make_key(f) {
    let file = if f.file != () { f.file } else { "" };
    let line = if f.line != () { f.line.to_string() } else { "0" };
    let cat = if f.category != () { f.category } else { "other" };
    let where = if f.where != () { f.where } else { "" };
    // Stable-enough identity without regex: file + line + category + first 80 of where
    let w = where;
    if w.len() > 80 {
        w = w.sub_string(0, 80);
    }
    file + ":" + line + ":" + cat + ":" + w
}

fn str_starts_with(s, prefix) {
    if type_of(s) != "string" || type_of(prefix) != "string" { return false; }
    if prefix.len() == 0 { return true; }
    if s.len() < prefix.len() { return false; }
    s.sub_string(0, prefix.len()) == prefix
}

fn is_under_root(path, root) {
    if path == () || type_of(path) != "string" { return false; }
    if root == "" || root == "." { return true; }
    if path == root || path == "./" + root { return true; }
    let prefix = root + "/";
    let prefix_dot = "./" + root + "/";
    str_starts_with(path, prefix) || str_starts_with(path, prefix_dot)
}

// ---------------------------------------------------------------------------
// Args / scope
// ---------------------------------------------------------------------------
// root: directory to audit (default ".claude")
// include_root_md: also scan CLAUDE.md / AGENTS.md / README.md at repo root (default true)
// max_verify: cap on verification fan-out (default 48)
// domains: optional array of domain keys to run (default: all)
let root = ".claude";
let include_root_md = true;
let max_verify = 64;
let domain_filter = ();

if args != () {
    if args.root != () && type_of(args.root) == "string" && trimmed(args.root) != "" {
        root = trimmed(args.root);
    }
    if args.include_root_md != () {
        include_root_md = args.include_root_md;
    }
    if args.max_verify != () {
        max_verify = args.max_verify;
    }
    if args.domains != () {
        domain_filter = args.domains;
    }
}

// ---------------------------------------------------------------------------
// Domain catalogue — fixed work-list (script owns scope; agents do judgment)
// ---------------------------------------------------------------------------
// Each domain: key, corpus description, focus (what to hunt), purity_flag (extra AI-config rules)
let all_domains = [
    #{
        key: "hooks-scripts",
        corpus: ".claude/hooks/**/*.ts + .claude/hooks/__tests__/** + .claude/scripts/** + .claude/commands/*.ts",
        focus: "Logic bugs, broken contracts with settings.json, dead exports, tests that assert removed behavior, shebang/path issues, refs to deleted hooks, error handling gaps.",
        purity: false,
    },
    #{
        key: "skills-commands",
        corpus: ".claude/skills/*/SKILL.md + references/ + .claude/commands/*.md",
        focus: "Dead links, refs to cut agents/skills, contradictory instructions, overlapping keywords that cause wrong activation, valueless boilerplate, broken Arch-H paths, prompts that encode session-specific or temporary workarounds.",
        purity: true,
    },
    #{
        key: "rules-docs-ssot",
        corpus: ".claude/rules/** + .claude/docs/** + .claude/output-styles/** + CLAUDE.md + AGENTS.md (if include_root_md)",
        focus: "Stale counts, contradictory SSOT, historical claims presented as current, orphan docs nothing reads, inventory drift vs disk, dead paths in system-inventory.",
        purity: true,
    },
    #{
        key: "settings-wiring",
        corpus: ".claude/settings.json + hook registration vs files on disk + package.json scripts + sync-claude LINK_FOLDERS",
        focus: "Registered hooks that do not exist, files that exist but are not wired, permissions that contradict documented posture, env vars that do nothing, machine-specific paths leaked into committed settings.",
        purity: true,
    },
    #{
        key: "dead-orphans-refs",
        corpus: "whole scoped tree: plans/_archive refs, audits/, learned/ (if tracked), comments TODO/FIXME/XXX, imports of missing modules",
        focus: "Orphan files with no readers, broken relative links, references to deleted components (builder/reviewer/scout, cut hooks), phantom config keys, code that can never run.",
        purity: false,
    },
    #{
        key: "config-purity",
        corpus: "always-loaded + synced AI config surface: CLAUDE.md, AGENTS.md, rules/, output-styles/, settings.json, skill frontmatter, hook always-fire paths",
        focus: "CRITICAL DOMAIN. Config must serve ANY AI session with ZERO session context. Flag: temporary notes, one-off personal reminders, dated workarounds without upgrade trigger, machine-local paths, secrets-shaped data, inventory numbers that rot, instructions that only make sense mid-feature, dead narrative, content that does not change agent behavior for all users/sessions. Prefer delete or move to on-demand skill/docs over leaving cruft in always-on layers.",
        purity: true,
    },
];

let domains = [];
for d in all_domains {
    let keep = true;
    if domain_filter != () && type_of(domain_filter) == "array" {
        keep = false;
        for k in domain_filter {
            if k == d.key { keep = true; }
        }
    }
    if keep {
        domains.push(d);
    }
}

if domains.len() == 0 {
    pause("verification", "No domains selected. Pass args.domains as a non-empty array of keys, or omit it for all.");
}

phase("Discover");
log("limpieza root=" + root + " domains=" + domains.len().to_string() + " max_verify=" + max_verify.to_string());

// ---------------------------------------------------------------------------
// Phase: Scan — one finder per domain
// ---------------------------------------------------------------------------
phase("Scan");

let scan_jobs = [];
for d in domains {
    let p = "";
    p += "You are a READ-ONLY cleanup auditor for domain \"" + d.key + "\" in the poneglyph AI-orchestration repo.\n";
    p += "Workspace root is the git repo. Scoped audit root: \"" + root + "\".\n";
    p += "Corpus: " + d.corpus + "\n";
    p += "Focus: " + d.focus + "\n\n";
    p += "MANDATORY PROCEDURE (cold start — do not answer from memory):\n";
    p += "1. Use list_dir / grep / read_file on the real files under the corpus. Start by listing the domain's directories.\n";
    p += "2. Cross-check claims against disk (a path mentioned in docs must exist; a hook in settings.json must have a file).\n";
    p += "3. For every REAL problem, emit a finding. Empty findings is valid ONLY after you inspected the corpus and found nothing.\n\n";
    p += "FINDING RULES:\n";
    p += "- Do NOT invent issues to fill a quota. Do NOT undervalue real issues (prefer accurate severity over politeness).\n";
    p += "- category: bug | dead_code | stale_ref | config_purity | valueless | contradiction | other\n";
    p += "- severity: BLOCKER (breaks runtime/safety) | MAJOR (wrong behavior or large dead weight in always-on) | MINOR | NIT\n";
    p += "- file: repo-relative path you actually opened\n";
    p += "- line: integer or null\n";
    p += "- where: precise location a human can jump to\n";
    p += "- why: root cause / why this class of problem appears\n";
    p += "- action: concrete (delete X; rewrite Y to Z; verify with command C; move to on-demand skill)\n";
    p += "- evidence: quote or describe what you read (file:line). No evidence = do not report.\n";
    p += "- confidence: HIGH if you verified on disk; MEDIUM if strong inference; LOW if uncertain\n";
    p += "- Cap 30 findings for this domain. Prefer highest-impact first. Report ALL that meet the bar up to the cap — never invent extras, never hide real ones.\n";
    p += "- scope_covered: what you actually inspected (paths + rough file counts).\n\n";
    if d.purity {
        p += "CONFIG PURITY LENS (mandatory for this domain):\n";
        p += "AI configuration must be for the AI agent and for ALL sessions — no required human session context.\n";
        p += "Flag anything temporary, one-off, machine-local, mid-feature narrative, or without durable behavioral value.\n";
        p += "Always-on layers (CLAUDE.md, rules, settings, output-style, always-fire hooks) have a higher bar: every line should change agent behavior usefully forever, or it is valueless/config_purity debt.\n";
        p += "Do not flag intentional on-demand skills/docs merely for being long; flag them if dead, contradictory, or unreferenced.\n\n";
    }
    if include_root_md {
        p += "Also consider repo-root CLAUDE.md / AGENTS.md / README.md when relevant to this domain.\n";
    }
    p += "Return JSON matching the schema: { findings: [...], scope_covered: \"...\" }.\n";

    scan_jobs.push(#{
        prompt: p,
        label: "scan:" + d.key,
        capability_mode: "read-only",
        output_schema: findings_schema,
    });
}

let scan_results = parallel(scan_jobs);

let raw_findings = [];
let scopes = [];
let i = 0;
for r in scan_results {
    let dkey = domains[i].key;
    if r == () || !r.success {
        log("scan FAILED or empty slot for " + dkey);
    } else {
        if r.output.scope_covered != () {
            scopes.push(dkey + ": " + r.output.scope_covered);
        }
        if r.output.findings != () {
            for f in r.output.findings {
                // Script-enforced scope filter (agents are untrusted for invariants)
                let path = if f.file != () { f.file } else { "" };
                let ok = is_under_root(path, root);
                // allow repo-root md files when include_root_md
                if !ok && include_root_md {
                    if path == "CLAUDE.md" || path == "AGENTS.md" || path == "README.md" || path == "Agents.md" {
                        ok = true;
                    }
                }
                // allow package.json / root config for settings-wiring
                if !ok && (path == "package.json" || path == "tsconfig.json") {
                    ok = true;
                }
                if ok {
                    // stamp domain for later
                    f.domain = dkey;
                    raw_findings.push(f);
                } else {
                    log("dropped out-of-scope finding path=" + path + " domain=" + dkey);
                }
            }
        }
    }
    i += 1;
}

log("raw findings after scan+filter: " + raw_findings.len().to_string());

if raw_findings.len() == 0 {
    let empty_body = "# Limpieza — no findings\n\n";
    empty_body += "Scanners returned zero in-scope findings after inspecting the corpus.\n\n";
    empty_body += "## Scope covered\n\n";
    for s in scopes {
        empty_body += "- " + s + "\n";
    }
    empty_body += "\nThis is a valid outcome only if each scanner used tools. If scopes look thin, re-run with a broader root.\n";
    let path = write_scratch_file("limpieza-report.md", empty_body);
    complete(#{
        summary: "No findings after scan.",
        path: path,
        confirmed: 0,
        rejected: 0,
        unverified: 0,
        scopes: scopes,
    });
}

// ---------------------------------------------------------------------------
// Phase: Verify — adversarial skeptic per finding (capped)
// ---------------------------------------------------------------------------
phase("Verify");

// Dedupe by make_key before verify to save budget (array scan — no dynamic map keys)
let unique = [];
let seen_keys = [];
for f in raw_findings {
    let k = make_key(f);
    let already = false;
    for sk in seen_keys {
        if sk == k { already = true; }
    }
    if !already {
        seen_keys.push(k);
        unique.push(f);
    }
}
log("unique findings pre-verify: " + unique.len().to_string() + " (from " + raw_findings.len().to_string() + " raw)");

let to_verify = [];
let dropped_cap = 0;
let idx = 0;
for f in unique {
    if idx < max_verify {
        to_verify.push(f);
    } else {
        dropped_cap += 1;
    }
    idx += 1;
}
if dropped_cap > 0 {
    log("VERIFY CAP: dropped " + dropped_cap.to_string() + " findings from verification (max_verify=" + max_verify.to_string() + "). Raise args.max_verify to cover more.");
}

let vjobs = [];
let vi = 0;
for f in to_verify {
    let fj = json_encode(f);
    let vp = "";
    vp += "You are an ADVERSARIAL verifier for a cleanup audit finding. Default bias: SKEPTICAL.\n";
    vp += "Set real=true ONLY if you independently re-read the cited file and the problem is still true.\n";
    vp += "Fail closed: missing file, wrong line, already fixed, historical-but-labeled-as-historical, or pure opinion → real=false.\n\n";
    vp += "FINDING (JSON):\n";
    vp += fj;
    vp += "\n\nPROCEDURE:\n";
    vp += "1. read_file / grep the path in finding.file (and nearby if line is off).\n";
    vp += "2. Confirm category/severity fit the evidence. Adjust severity_adjusted if the finder exaggerated or understated.\n";
    vp += "3. evidence must cite what YOU opened this turn.\n";
    vp += "4. If real, optionally refine action_adjusted.\n";
    vp += "Return { real, reason, evidence, severity_adjusted, action_adjusted }.\n";

    let label_file = if f.file != () { f.file } else { "unknown" };
    // keep label short
    if label_file.len() > 40 {
        label_file = label_file.sub_string(label_file.len() - 40, 40);
    }
    vjobs.push(#{
        prompt: vp,
        label: "verify:" + vi.to_string() + ":" + label_file,
        capability_mode: "read-only",
        output_schema: verdict_schema,
    });
    vi += 1;
}

let verdicts = parallel(vjobs);

let confirmed = [];
let rejected = [];
let unverified = [];
let j = 0;
for v in verdicts {
    let f = to_verify[j];
    if v == () || !v.success {
        f.verify_status = "unverified";
        unverified.push(f);
    } else if v.output.real == true && v.output.evidence != () && trimmed(v.output.evidence) != "" {
        if v.output.severity_adjusted != () && trimmed(v.output.severity_adjusted) != "" {
            f.severity = v.output.severity_adjusted;
        }
        if v.output.action_adjusted != () && trimmed(v.output.action_adjusted) != "" {
            f.action = v.output.action_adjusted;
        }
        f.verify_reason = v.output.reason;
        f.verify_evidence = v.output.evidence;
        f.verify_status = "confirmed";
        confirmed.push(f);
    } else {
        f.verify_status = "rejected";
        f.verify_reason = if v.output.reason != () { v.output.reason } else { "rejected without reason" };
        rejected.push(f);
    }
    j += 1;
}

// Cap-dropped unique findings count as unverified (honest accounting)
if dropped_cap > 0 {
    let k2 = 0;
    for f in unique {
        if k2 >= max_verify {
            f.verify_status = "unverified_cap";
            unverified.push(f);
        }
        k2 += 1;
    }
}

log("verify: confirmed=" + confirmed.len().to_string()
    + " rejected=" + rejected.len().to_string()
    + " unverified=" + unverified.len().to_string());

// Sort confirmed by severity rank
let sorted = [];
for rank in [0, 1, 2, 3] {
    for f in confirmed {
        if severity_rank(f.severity) == rank {
            sorted.push(f);
        }
    }
}
confirmed = sorted;

// ---------------------------------------------------------------------------
// Phase: Synthesize — writer agent + scratch report
// ---------------------------------------------------------------------------
phase("Synthesize");

let payload = #{
    root: root,
    scopes: scopes,
    confirmed: confirmed,
    rejected: rejected,
    unverified: unverified,
    stats: #{
        confirmed: confirmed.len(),
        rejected: rejected.len(),
        unverified: unverified.len(),
        raw: raw_findings.len(),
        unique: unique.len(),
        dropped_verify_cap: dropped_cap,
    },
};

let payload_json = json_encode(payload);

let sp = "";
sp += "You are the SYNTHESIS WRITER for a cleanup audit (limpieza) of an AI orchestration config repo.\n";
sp += "You receive verified findings as JSON. Produce a clear, actionable markdown report in Spanish (es-ES).\n";
sp += "Do NOT invent new findings. Do NOT drop confirmed ones. Do NOT soft-pedal severity.\n\n";
sp += "DATA (JSON):\n";
sp += payload_json;
sp += "\n\nREPORT STRUCTURE (body_markdown):\n";
sp += "# Limpieza — informe de hallazgos\n\n";
sp += "## Resumen ejecutivo\n";
sp += "Counts by severity and category; top 3 themes.\n\n";
sp += "## Hallazgos confirmados\n";
sp += "One subsection or table row per finding, ordered BLOCKER → NIT:\n";
sp += "- **Dónde** (file:line + where)\n";
sp += "- **Qué** (category + short problem)\n";
sp += "- **Por qué** (why)\n";
sp += "- **Acción** (action)\n";
sp += "- **Evidencia** (verify_evidence)\n";
sp += "- Severity + confidence + domain\n\n";
sp += "## Rechazados (falsos positivos / no reproducibles)\n";
sp += "Brief list so the human sees what was discarded and why.\n\n";
sp += "## Sin verificar\n";
sp += "Budget-capped or failed verification — do not treat as confirmed.\n\n";
sp += "## Alcance inspeccionado\n";
sp += "scopes from scanners.\n\n";
sp += "## Orden de ataque sugerido\n";
sp += "Numbered sequence: config_purity + BLOCKER first, then dead_code/stale_ref in always-on layers, then the rest.\n\n";
sp += "title: short title. summary: one paragraph BLUF. body_markdown: full report.\n";
sp += "stats: echo confirmed/rejected/unverified integers.\n";

let writer = agent(sp, #{
    label: "synthesize-report",
    capability_mode: "read-only",
    output_schema: report_schema,
});

let body = "";
let title = "Limpieza";
let summary = "";

if writer != () && writer.success && writer.output.body_markdown != () {
    body = writer.output.body_markdown;
    if writer.output.title != () { title = writer.output.title; }
    if writer.output.summary != () { summary = writer.output.summary; }
} else {
    // Deterministic fallback so the run still delivers value
    summary = confirmed.len().to_string() + " confirmed / "
        + rejected.len().to_string() + " rejected / "
        + unverified.len().to_string() + " unverified";
    body = "# Limpieza — informe de hallazgos\n\n";
    body += "## Resumen ejecutivo\n\n" + summary + "\n\n";
    body += "## Hallazgos confirmados\n\n";
    if confirmed.len() == 0 {
        body += "_Ninguno confirmado._\n\n";
    }
    let n = 1;
    for f in confirmed {
        let line_s = if f.line != () { f.line.to_string() } else { "?" };
        body += "### " + n.to_string() + ". [" + f.severity + "] " + f.category + " — " + f.file + ":" + line_s + "\n\n";
        body += "- **Dónde:** " + f.where + "\n";
        body += "- **Por qué:** " + f.why + "\n";
        body += "- **Acción:** " + f.action + "\n";
        if f.verify_evidence != () {
            body += "- **Evidencia:** " + f.verify_evidence + "\n";
        }
        if f.domain != () {
            body += "- **Dominio:** " + f.domain + "\n";
        }
        body += "- **Confianza:** " + f.confidence + "\n\n";
        n += 1;
    }
    body += "## Rechazados\n\n";
    for f in rejected {
        body += "- " + f.file + " — " + f.where + " _(" + f.verify_reason + ")_\n";
    }
    body += "\n## Sin verificar\n\n";
    for f in unverified {
        body += "- " + f.file + " — " + f.where + " _(" + f.verify_status + ")_\n";
    }
    body += "\n## Alcance inspeccionado\n\n";
    for s in scopes {
        body += "- " + s + "\n";
    }
}

let report_path = write_scratch_file("limpieza-report.md", body);

complete(#{
    title: title,
    summary: summary,
    path: report_path,
    confirmed: confirmed.len(),
    rejected: rejected.len(),
    unverified: unverified.len(),
    dropped_verify_cap: dropped_cap,
    domains: domains.len(),
});
