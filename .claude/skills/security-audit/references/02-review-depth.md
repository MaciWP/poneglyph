---
parent: security-audit
name: review-depth
description: Depth beyond the Top 10 quick-ref — ASVS rigor levels, Proactive Controls, auth/session/JWT/access-control specifics, secret-leak response. OWASP/GitHub primary-sourced.
---

# Security Review — Depth Layer

Complements the Top 10 quick-ref (`references/owasp-quick-ref.md`) and the pre-deploy
checklist. Every claim here is OWASP/GitHub primary-sourced and survived adversarial
verification (3-0). Where a widely-held practice is NOT primary-verified, it is flagged as
such — do not present those as OWASP-mandated.

## 1. Calibrate rigor — ASVS verification levels (4.0.3)

Pick the review depth from the app's data sensitivity, before reviewing. ASVS "normalizes
the coverage and level of rigor" of a web-app review.

| Level | Use for | Review method |
|---|---|---|
| **L1** | Low-risk apps, no sensitive data | The only level fully verifiable by penetration testing alone |
| **L2** | Apps handling sensitive / business-critical data | **Practical default for a commercial review** — hybrid (pentest + source) |
| **L3** | Life-/safety-critical, large volumes of regulated data | Source review + threat modeling required |

> Source: OWASP ASVS 4.0.3 — `https://owasp.org/www-project-application-security-verification-standard/`.
> ASVS auth chapters (V2/V3) are a compliant subset of NIST 800-63b (L1/L2/L3 → AAL1/2/3).
> Note: ASVS 5.0 reframes the level model — this reference pins **4.0.x**.

## 2. Positive guidance — OWASP Proactive Controls 2024 (C1–C10)

The Top 10 says what NOT to do; Proactive Controls say what TO do, applied early. Check the
code builds these in, not just that it lacks Top-10 flaws:

`C1` Implement Access Control · `C2` Use Cryptography the proper way · `C3` Validate Input &
Handle Exceptions · `C4` Address Security from the Start · `C5` Secure-by-Default Config ·
`C6` Keep Components Secure · `C7` Secure Digital Identities · `C8` Leverage Browser Security
Features · `C9` Security Logging & Monitoring · `C10` Stop SSRF.

> Source: `https://top10proactive.owasp.org/the-top-10/` + OWASP Developer Guide.

## 3. Auth / session / JWT / access-control review specifics

**Authentication** (OWASP Authentication Cheat Sheet):
- [ ] MFA offered and enforced for sensitive operations — "by far the best defense" (~99.9% of account compromises stopped per Microsoft).
- [ ] Auth-failure responses are **generic and identical** whether the user ID, the password, or the account existence was wrong (uniform timing/length too) — prevents account enumeration.
- [ ] Breached-password blocking + rate limiting (credential stuffing); no forced periodic rotation.

**Session management** (OWASP Session Management Cheat Sheet):
- [ ] Session IDs ≥ 64 bits of entropy (≥ 16 hex chars) from a CSPRNG.
- [ ] Session ID **regenerated on any privilege change** — mandatory at authentication (prevents session fixation).
- [ ] Cookies set `Secure` (HTTPS-only) and `HttpOnly` (mandatory — blocks XSS session theft).
- [ ] Timeout/expiration and logout invalidation enforced **server-side** (client-side is manipulable).

**JWT** (OWASP JWT / REST / WSTG):
- [ ] Validation **pins the expected algorithm**; never trusts the header `alg`. Defeats the `none`/`NoNe` bypass and the RS256→HS256 confusion attack (attacker re-signs with HS256 using the public key as the HMAC secret).
- [ ] Signature actually verified — test by altering the payload (e.g. flip `is_admin`) leaving header/signature unchanged; it must reject.
- [ ] A JWT has no built-in revocation (valid until expiry) — logout/expiry alone can't terminate a session. Add server-side state (denylist on `jti`, short-lived tokens + refresh-token revocation, or an allowlist). `[Probable — the 2-1 dissent contested only "requires a jti denylist"; some server-side state IS necessary, the exact mechanism is a choice]`

**Access control / IDOR-BOLA** (OWASP REST Cheat Sheet + ASVS V4.2.1/V4.1.3):
- [ ] Access control enforced at **every non-public endpoint** — verify the caller is authorized for the specific HTTP method, collection, action, AND record.
- [ ] Authenticated users can reach only their own/authorized data (ASVS V4.2.1 IDOR; V4.1.3 least privilege). This is the verification control for A01:2021 Broken Access Control / API1 BOLA.

## 4. Secret-leak incident response — done right

Verified principle (GitHub Docs, "Removing sensitive data"; OWASP Secrets Management):

1. **Revoke/rotate the secret FIRST** — before any history rewrite. Assume it is already harvested.
2. **History rewrite alone never mitigates a leak.** The leaked commit persists in clones, forks, GitHub SHA-1 cached views, and referencing pull requests. Rewriting is cleanup, not remediation.

> Tool-level specifics — `git filter-repo` over the deprecated `git filter-branch`, and
> `git push --force-with-lease` over plain `--force` — are widely-held industry/GitHub
> best practice but were **NOT** primary-source-verified in this research pass. Apply them,
> but don't present them as OWASP-mandated; the verified core is rotate-first +
> rewrite-is-insufficient. History rewrites/force-push need explicit user authorization (Commandment VI).
