# OWASP Top 10 Quick Reference

Edition: OWASP Top 10:2025 (https://owasp.org/Top10/). SSRF is part of A01.

## Contents

- [A01:2025 Broken Access Control](#a012025-broken-access-control)
- [A02:2025 Security Misconfiguration](#a022025-security-misconfiguration)
- [A03:2025 Software Supply Chain Failures](#a032025-software-supply-chain-failures)
- [A04:2025 Cryptographic Failures](#a042025-cryptographic-failures)
- [A05:2025 Injection](#a052025-injection)
- [A06:2025 Insecure Design](#a062025-insecure-design)
- [A07:2025 Authentication Failures](#a072025-authentication-failures)
- [A08:2025 Software or Data Integrity Failures](#a082025-software-or-data-integrity-failures)
- [A09:2025 Security Logging and Alerting Failures](#a092025-security-logging-and-alerting-failures)
- [A10:2025 Mishandling of Exceptional Conditions](#a102025-mishandling-of-exceptional-conditions)

Detailed vulnerability descriptions with detection methods and before/after examples.

## A01:2025 Broken Access Control

**Problem**: Missing authorization checks allow unauthorized access.

**Detection**:
- Endpoints without auth middleware
- No ownership verification on resource access
- Role checks missing on admin operations

**BEFORE** (vulnerable):
```pseudocode
ENDPOINT GET /api/users/{id}:
    user = database.findUserById(id)
    RETURN user
    // Anyone can access any user's data: no auth check
```

**AFTER** (secure):
```pseudocode
ENDPOINT GET /api/users/{id}:
    IF currentUser IS NOT authenticated:
        THROW UnauthorizedError
    IF id != currentUser.id AND currentUser.role != "admin":
        THROW ForbiddenError("Cannot access other users")
    user = database.findUserById(id)
    RETURN user
```

### SSRF (CWE-918, part of A01:2025)


**Problem**: Server makes requests to user-controlled URLs.

**Detection**:
- HTTP request with user-provided URL
- No URL validation
- Access to internal network

**BEFORE** (vulnerable):
```pseudocode
// User-controlled URL: can target internal services
data = httpGet(userProvidedUrl)

ENDPOINT GET /proxy:
    RETURN httpGet(query.url)  // Can reach internal network
```

**AFTER** (secure):
```pseudocode
ALLOWED_HOSTS = ["api.github.com", "api.stripe.com"]

ENDPOINT GET /proxy:
    url = parseURL(query.url)

    IF url.host NOT IN ALLOWED_HOSTS:
        THROW BadRequestError("Host not allowed")

    IF url.protocol != "https":
        THROW BadRequestError("HTTPS required")

    // Block internal/private IP addresses
    ip = dnsResolve(url.hostname)
    IF isPrivateIP(ip):
        THROW BadRequestError("Internal hosts not allowed")

    RETURN httpGet(url)
```

## A02:2025 Security Misconfiguration

**Problem**: Insecure default configurations.

**Detection**:
- Open CORS
- Missing security headers
- Debug mode in production

**BEFORE** (vulnerable):
```pseudocode
// Open CORS: any origin can make requests
setCORS(origin="*")

// No security headers: browser protections disabled
server.start(port=3000)
```

**AFTER** (secure):
```pseudocode
// Restricted CORS: only trusted origins
setCORS(
    origin=["https://myapp.com"],
    credentials=true,
    methods=["GET", "POST", "PUT", "DELETE"]
)

// Security headers via middleware or server config
setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
setHeader("X-Frame-Options", "DENY")
setHeader("X-Content-Type-Options", "nosniff")
setHeader("Content-Security-Policy", "default-src 'self'")
```

## A03:2025 Software Supply Chain Failures

**Problem**: Using components with known vulnerabilities, or trusting the build chain (registries, CI actions, build scripts) without verification.

**Detection**:
- Outdated dependencies
- Known CVEs in packages
- Missing lock file
- CI actions or images referenced by mutable tag instead of a pinned digest/SHA
- Dependencies installed from unverified sources or with install scripts left enabled

**Fix pattern**:
```pseudocode
// Regular security audits (use your package manager's audit command)
packageManager audit

// Update dependencies
packageManager update

// Use lock files and exact versions
packageManager install --frozen-lockfile
```

## A04:2025 Cryptographic Failures

**Problem**: Weak hashing or exposed secrets.

**Detection**:
- MD5, SHA1 used for passwords
- Hardcoded secrets in source code
- Unencrypted sensitive data

**BEFORE** (vulnerable):
```pseudocode
// Weak hashing. MD5 is trivially reversible
hash = MD5(password)

// Hardcoded secret: exposed in version control
JWT_SECRET = "my-secret-key"
```

**AFTER** (secure):
```pseudocode
// Strong hashing: use argon2id or bcrypt with cost >= 10
hash = hashPassword(password, algorithm="argon2id")

// Secret from environment variable
JWT_SECRET = environment.get("JWT_SECRET")
IF JWT_SECRET IS EMPTY OR length(JWT_SECRET) < 32:
    THROW Error("JWT_SECRET must be at least 32 characters")
```

## A05:2025 Injection

**Problem**: Untrusted data interpreted as code/commands.

**Detection**:
- String concatenation in queries
- eval() or equivalent with user input
- Shell exec with user input

**BEFORE** (vulnerable):
```pseudocode
// SQL injection: user input interpolated into query
database.query("SELECT * FROM users WHERE id = '" + userId + "'")

// Command injection: unsanitized input passed to shell
shell.exec("git clone " + userUrl)

// Code injection: arbitrary code execution
evaluate(userProvidedCode)
```

**AFTER** (secure):
```pseudocode
// Parameterized query: input treated as data, not SQL
database.query("SELECT * FROM users WHERE id = ?", [userId])

// Validated command: allowlist pattern
IF userUrl DOES NOT MATCH pattern "^https://github.com/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+.git$":
    THROW Error("Invalid repository URL")
safeClone(userUrl)

// Never evaluate user input; use safe alternatives like JSON parsing
result = parseJSON(userProvidedJson)
```

## A06:2025 Insecure Design

**Problem**: Missing security controls at design level.

**Detection**:
- No rate limiting on auth endpoints
- No account lockout
- Insecure password reset flow

**BEFORE** (vulnerable):
```pseudocode
ENDPOINT POST /api/login:
    user = authenticate(body.email, body.password)
    RETURN { token: generateToken(user) }
    // No rate limiting: attacker can brute force passwords
```

**AFTER** (secure):
```pseudocode
// Apply rate limiting: max 5 attempts per minute per email
RATE_LIMIT(max=5, window="1m", keyBy=body.email)

ENDPOINT POST /api/login:
    attempts = getFailedAttempts(body.email)
    IF attempts >= 5:
        THROW TooManyRequestsError("Account locked. Try again in 15 minutes.")

    user = authenticate(body.email, body.password)
    IF user IS NULL:
        incrementFailedAttempts(body.email)
        THROW UnauthorizedError("Invalid credentials")

    clearFailedAttempts(body.email)
    RETURN { token: generateToken(user) }
```

## A07:2025 Authentication Failures

**Problem**: Weak authentication mechanisms.

**Detection**:
- Weak password requirements
- Predictable session tokens
- Missing session invalidation

**BEFORE** (vulnerable):
```pseudocode
// Predictable session: user ID as token
setCookie("session", toString(userId))

// Weak password requirements
IF length(password) >= 4:
    accept()
```

**AFTER** (secure):
```pseudocode
// Cryptographically random session token
sessionToken = generateCryptoRandomUUID()
setCookie("session", sessionToken,
    httpOnly=true,
    secure=true,
    sameSite="strict",
    maxAge=3600
)

// Strong password requirements
FUNCTION validatePassword(password):
    RETURN length(password) >= 12
        AND containsUppercase(password)
        AND containsLowercase(password)
        AND containsDigit(password)
        AND containsSpecialChar(password)
```

## A08:2025 Software or Data Integrity Failures

**Problem**: Trusting untrusted data without verification.

**Detection**:
- No signature verification
- Deserializing untrusted data
- Missing input validation

**BEFORE** (vulnerable):
```pseudocode
// No JWT verification: just decode and trust
payload = base64Decode(token.split(".")[1])

// Trusting client-submitted total
order = parseJSON(body.order)  // Client could manipulate price
```

**AFTER** (secure):
```pseudocode
// Verify JWT signature with secret
payload = verifyJWT(token, environment.get("JWT_SECRET"))

// Validate schema, then recalculate server-side
order = validateSchema(body, orderSchema)
order.total = calculateTotal(order.items)  // Never trust client-computed values
```

## A09:2025 Security Logging and Alerting Failures

**Problem**: Missing or insecure logging.

**Detection**:
- Sensitive data in logs
- Missing auth event logging
- Logs accessible publicly

**BEFORE** (vulnerable):
```pseudocode
// Sensitive data in logs: password and token exposed
log("Login attempt:", { email, password, token })

// No audit trail
createUser(userData)
```

**AFTER** (secure):
```pseudocode
// Safe logging: only non-sensitive fields
logger.info("Login attempt", {
    email: email,
    success: false,
    ip: request.ip,
    userAgent: request.userAgent
})

// Audit logging for security-relevant operations
createUser(userData)
logger.audit("user.created", {
    userId: user.id,
    createdBy: currentUser.id,
    timestamp: now()
})
```

## A10:2025 Mishandling of Exceptional Conditions

**Problem**: Errors and abnormal conditions are not handled safely: the code fails open, leaks internals or leaves state half-changed.

**Detection**:
- `catch` blocks that swallow the error and continue as if it succeeded
- Authorization or validation that defaults to "allow" when a check throws
- Stack traces, SQL or internal paths returned to the client
- Multi-step writes without a transaction or rollback on failure

**Fix pattern**:
```pseudocode
// BEFORE: fails open
TRY:
    allowed = authz.check(user, resource)
CATCH error:
    allowed = TRUE

// AFTER: fail closed, log, generic message
TRY:
    allowed = authz.check(user, resource)
CATCH error:
    log.error("authz check failed", { requestId, error })
    allowed = FALSE
IF NOT allowed:
    THROW ForbiddenError("Access denied")
```
