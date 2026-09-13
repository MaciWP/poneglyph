---
name: security-audit
description: |
  Revisión de seguridad de los cambios pendientes: secretos hardcodeados, validación de inputs en boundaries, vectores OWASP Top 10, superficie de amenaza.
  Úsala cuando: el cambio toca auth/pagos/secretos/credenciales/crypto/sesión, "revisa la seguridad", "esto es seguro", "vulnerabilidad", "auth", "jwt", "secrets".
metadata:
  keywords: >
    Keywords - security, owasp, vulnerability, injection, xss, csrf, audit
disable-model-invocation: false
argument-hint: "[file-path or module]"
effort: xhigh
paths:
  - "**/auth/**"
  - "**/api/**"
  - "**/middleware/**"
  - "**/*security*"
  - "**/*.env*"
when_to_use: |
  "revisa la seguridad", "esto es seguro", "vulnerabilidad", "auth/jwt/secrets", "security review", "is this secure", "threat surface"
---

# Security Review Checklist

OWASP Top 10 based security audit. Language-agnostic patterns applicable to any stack.

## When to Use

- Reviewing authentication/authorization code
- Auditing user input handling
- Checking for common vulnerabilities
- Pre-deployment security review
- Code that handles sensitive data (passwords, tokens, PII)
- API endpoints exposed to public internet
- File upload or download functionality

## Review Checklist

38 items across 6 categories: Authentication (8), Authorization (6), Input Validation (7), Data Protection (6), Headers & Configuration (6), Logging & Monitoring (5).

For the full deployment checklist, see `checklists/pre-deploy.md`.

## Red Flags

| Pattern | Severity | Risk | Detection |
|---------|----------|------|-----------|
| `eval(userInput)` | Critical | Code injection | Grep for `eval(` or equivalent |
| User input interpolated in SQL | Critical | SQL injection | Check string interpolation in queries |
| Raw user input in HTML output | Critical | XSS | Grep for unsanitized output |
| Shell exec with user input | Critical | Command injection | Grep for exec/spawn with variables |
| MD5 or SHA1 for passwords | High | Weak hashing | Grep for weak hash algorithms |
| Hardcoded secrets in source | High | Secret exposure | Grep for secrets in code |
| CORS allows all origins | High | Open CORS | Check CORS config |
| Session cookie without httpOnly | High | Session hijacking | Check cookie options |
| Sensitive data in log output | Medium | Data leak | Grep for sensitive vars in logs |
| HTTP URLs in production | Medium | MitM attack | Check for hardcoded URLs |
| No rate limiting on auth | Medium | Brute force | Check auth endpoints |
| JSON parsing without error handling | Low | DoS | Check error handling |

## OWASP Top 10 Summary

| ID | Issue | Key Risk |
|----|-------|----------|
| A01 | Broken Access Control | Missing auth/ownership checks |
| A02 | Cryptographic Failures | Weak hashing, exposed secrets |
| A03 | Injection | SQL/command/code injection via user input |
| A04 | Insecure Design | No rate limiting, no lockout |
| A05 | Security Misconfiguration | Open CORS, missing headers |
| A06 | Vulnerable Components | Outdated deps with CVEs |
| A07 | Authentication Failures | Weak passwords, predictable tokens |
| A08 | Data Integrity Failures | No signature verification |
| A09 | Logging Failures | Sensitive data in logs |
| A10 | SSRF | User-controlled URLs to internal services |

For detailed patterns with detection methods and before/after examples, see `references/owasp-quick-ref.md`.

## Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| Critical | Active exploitation possible, immediate data breach risk | Immediate (< 4h) | SQL injection, RCE, auth bypass |
| High | Significant vulnerability, exploitation requires some effort | 24 hours | Weak hashing, open CORS with credentials, XSS |
| Medium | Limited impact or exploitation difficulty | 1 week | Missing rate limiting, info disclosure |
| Low | Minor issues, defense in depth | Next sprint | Missing security headers, verbose errors |

## Output Format

```markdown
## Security Review: [Component]

### Critical Issues
- **A03 Injection**: SQL injection in `userService.ts:45`
  - Line: `db.query("SELECT * FROM users WHERE id = '" + id + "'")`
  - Fix: Use parameterized query or ORM
  - CVSS: 9.8

### High Severity
- **A07 Auth**: Session not invalidated on logout
  - File: `auth.ts:120`
  - Fix: Clear session token on logout endpoint

### Medium Severity
- **A09 Logging**: Password logged in error handler
  - File: `error.ts:30`
  - Fix: Sanitize error objects before logging

### Low Severity
- **A06 Components**: Outdated dependency with known CVE
  - Fix: Update dependency to latest version

### Passed Checks
- [x] Password hashing uses argon2id
- [x] CORS properly configured
- [x] JWT from environment variable
- [x] Input validation with schema library
```

## Gotchas

| Gotcha | Why | Workaround |
|--------|-----|------------|
| Output encoding forgotten (sanitize input but render unsanitized output) | Input validation alone doesn't prevent stored XSS when data is rendered later | Sanitize at BOTH input validation AND output rendering |
| CORS `Access-Control-Allow-Origin: *` with credentials fails silently | Browsers reject wildcard origin when `credentials: true` is set | Use explicit origin, never wildcard with `credentials: true` |
| bcrypt rounds below 10 are brute-forceable on modern GPUs | Low cost factor makes hash computation too fast for attackers | Minimum 12 rounds for passwords, 10 absolute minimum |
| JWT stored in localStorage is XSS-vulnerable | Any XSS can read localStorage and exfiltrate tokens | Use httpOnly cookies for tokens, localStorage only for non-sensitive data |
| Rate limiting on proxy but not app server | Direct access to app server bypasses proxy rate limits | Apply rate limiting at application level too, not just reverse proxy |

## Scripts

| Script | Input | Output | Usage |
|--------|-------|--------|-------|
| `scripts/scan-secrets.ts` | file/dir path | JSON `{ findings, total }` | `bun .claude/skills/security-audit/scripts/scan-secrets.ts <path>` |

## Secret Detection Patterns

| Secret Type | Regex Pattern | Example |
|------------|---------------|---------|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | AKIAIOSFODNN7EXAMPLE |
| GitHub Token | `gh[opsr]_[A-Za-z0-9_]{36,}` | ghp_xxxx... |
| Stripe Live | `sk_live_[A-Za-z0-9]{24,}` | sk_live_xxxx... |
| Anthropic | `sk-ant-[A-Za-z0-9-]{20,}` | sk-ant-xxxx... |
| OpenAI | `sk-[A-Za-z0-9]{32,}` | sk-xxxx... |
| Google API | `AIza[0-9A-Za-z-_]{35}` | AIzaSyxxxx... |
| Generic Password | `(?i)(password\|passwd\|pwd)\s*[:=]\s*['"][^'"]{8,}` | password='secret123' |
| Bearer Token | `Bearer\s+[A-Za-z0-9\-._~+/]+=*` | Bearer eyJhbG... |
| Private Key | `-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----` | PEM block |

## SQL Injection — Safe Parameterization by Tech

| Technology | Safe Pattern | Unsafe Pattern |
|-----------|-------------|----------------|
| PostgreSQL | `$1, $2, $3` (positional) | String concatenation |
| MySQL | `?` (positional) | Template literals |
| SQLite (Bun) | `db.prepare(sql).get(param)` | `db.query(sql + value)` |
| MongoDB | `{ field: value }` (object) | `{ $where: userInput }` |

### Dynamic WHERE Clause (Safe)
```typescript
const conditions: string[] = [];
const params: any[] = [];
let idx = 1;
if (filter.name) { conditions.push(`name = $${idx++}`); params.push(filter.name); }
if (filter.status) { conditions.push(`status = $${idx++}`); params.push(filter.status); }
const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
```

## Content Map

Supporting files loaded on demand based on task context. Consult the Contents column to decide which to Read for your current task.

| Topic | File | Contents |
|---|---|---|
| OWASP Top 10 quick reference | `${CLAUDE_SKILL_DIR}/references/owasp-quick-ref.md` | Detailed per-vulnerability descriptions (A01-A10) with Problem / Detection / BEFORE-vulnerable / AFTER-secure pseudocode pairs. Read when you need the full vulnerability explanation with code examples — e.g., fixing an identified A03 injection or A01 access control issue, or generating a remediation plan with concrete before/after snippets. |
| Pre-deploy security checklist | `${CLAUDE_SKILL_DIR}/checklists/pre-deploy.md` | Full 38-item checklist across 6 categories (Auth 8, Authz 6, Input Validation 7, Data Protection 6, Headers/Config 6, Logging 5) — each item is a boolean gate. Read when doing a pre-deployment audit, or when the `## Review Checklist` summary in this SKILL.md is not granular enough and you need concrete pass/fail items to tick. |
| Review depth layer | `${CLAUDE_SKILL_DIR}/references/02-review-depth.md` | Beyond the Top 10: ASVS rigor levels (L1/L2/L3 — pick by data sensitivity), OWASP Proactive Controls 2024 (C1-C10 positive guidance), and concrete auth/session/JWT/access-control review checklists (MFA, session fixation, JWT alg-pinning, IDOR/BOLA) + secret-leak incident response (rotate-first). Read when reviewing auth/session/access-control code, calibrating review rigor, or handling a leaked secret. OWASP/GitHub primary-sourced. |

## Emergency: Secret Committed to Git

1. **Rotate the secret immediately** — assume compromised. This is the only step that actually mitigates exposure; history rewriting does NOT (the secret is already cloned/cached). Do this first, regardless of the rest.
2. **Remove from history**: `git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch PATH' HEAD` (or `git filter-repo`, preferred upstream). ⚠️ History rewrite — get explicit user authorization before running (Commandment VI: `--force`/history rewrites require it).
3. **Force push**: `git push --force-with-lease` (never bare `--force`) — coordinate with team first; rewriting shared history is irreversible for collaborators. ⚠️ Requires explicit authorization (Commandment VI).
4. **Audit**: Check access logs for the compromised credential
5. **Add to .gitignore**: Prevent recurrence

> The secret is compromised the instant it is pushed — step 1 (rotation) is what protects you. Steps 2-3 only clean the record and are destructive; never run them unprompted. Full rationale (why history rewrite alone never mitigates) in `references/02-review-depth.md` §4.

## Commandments cubiertos

| # | Cómo |
|---|---|
| II | Findings are evidence-backed (OWASP refs, secret patterns) — not speculative "looks risky" |
| IV | Security is a blocking gate in the `flow-review` phase for auth/payments/credentials/crypto |
| VI | The core skill — secret-leak prevention; history-rewrite/force-push gated on Cmd VI authorization |

## Related

- `flow-review` — Phase 4 owner that dispatches this skill on sensitive surfaces.
- Verify the vulnerable path/symbol exists before reporting it (`changes-verify` → existence checks).

---

**Version**: 2.0
**For**: Phase 4 `flow-review` (Step 7 dispatch for auth/payments/secrets/credentials/crypto). The legacy `reviewer` agent was cut in feature 008.
**Patterns**: Language-agnostic
