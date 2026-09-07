# Pre-Deploy Security Checklist

## Authentication (8 items)

- [ ] Passwords hashed with argon2id or bcrypt (cost >= 10)
- [ ] JWT secrets from environment variables (min 256 bits)
- [ ] Session tokens are cryptographically random
- [ ] Cookies set with httpOnly, secure, sameSite=strict
- [ ] Session invalidation on logout implemented
- [ ] Password reset tokens expire (< 1 hour)
- [ ] Account lockout after 5 failed attempts
- [ ] 2FA available for sensitive accounts

## Authorization (6 items)

- [ ] Every endpoint has auth middleware
- [ ] Resource ownership verified before access
- [ ] Role checks before sensitive operations
- [ ] No direct object references (IDOR)
- [ ] Admin routes protected with additional checks
- [ ] No privilege escalation paths

## Input Validation (7 items)

- [ ] All user input validated with schema validation library
- [ ] File uploads validated (type, size, content)
- [ ] No raw SQL queries with string concatenation
- [ ] HTML output escaped/sanitized
- [ ] JSON parsing with error handling
- [ ] URL/path traversal prevention
- [ ] Regex DoS prevention (no catastrophic backtracking)

## Data Protection (6 items)

- [ ] Sensitive data encrypted at rest (AES-256)
- [ ] No secrets in source code or logs
- [ ] Environment files excluded from version control
- [ ] Database credentials secure and rotated
- [ ] PII minimized and retention policies applied
- [ ] Secure deletion of sensitive data

## Headers & Configuration (6 items)

- [ ] HTTPS enforced (HSTS header)
- [ ] CORS restricted to specific origins
- [ ] CSP header configured
- [ ] X-Frame-Options set to DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Debug mode disabled in production

## Logging & Monitoring (5 items)

- [ ] Auth events logged (login, logout, failed attempts)
- [ ] Access control failures logged
- [ ] No sensitive data in logs (passwords, tokens, PII)
- [ ] Logs protected from tampering
- [ ] Alerting on suspicious activity
