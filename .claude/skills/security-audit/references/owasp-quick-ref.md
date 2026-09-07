# OWASP Top 10 Quick Reference

## Contents

- [A01: Broken Access Control](#a01-broken-access-control)
- [A02: Cryptographic Failures](#a02-cryptographic-failures)
- [A03: Injection](#a03-injection)
- [A04: Insecure Design](#a04-insecure-design)
- [A05: Security Misconfiguration](#a05-security-misconfiguration)
- [A06: Vulnerable Components](#a06-vulnerable-components)
- [A07: Authentication Failures](#a07-authentication-failures)
- [A08: Data Integrity Failures](#a08-data-integrity-failures)
- [A09: Logging Failures](#a09-logging-failures)
- [A10: SSRF (Server-Side Request Forgery)](#a10-ssrf-server-side-request-forgery)

Detailed vulnerability descriptions with detection methods and before/after examples.

## A01: Broken Access Control

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
    // Anyone can access any user's data — no auth check
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

## A02: Cryptographic Failures

**Problem**: Weak hashing or exposed secrets.

**Detection**:
- MD5, SHA1 used for passwords
- Hardcoded secrets in source code
- Unencrypted sensitive data

**BEFORE** (vulnerable):
```pseudocode
// Weak hashing — MD5 is trivially reversible
hash = MD5(password)

// Hardcoded secret — exposed in version control
JWT_SECRET = "my-secret-key"
```

**AFTER** (secure):
```pseudocode
// Strong hashing — use argon2id or bcrypt with cost >= 10
hash = hashPassword(password, algorithm="argon2id")

// Secret from environment variable
JWT_SECRET = environment.get("JWT_SECRET")
IF JWT_SECRET IS EMPTY OR length(JWT_SECRET) < 32:
    THROW Error("JWT_SECRET must be at least 32 characters")
```

## A03: Injection

**Problem**: Untrusted data interpreted as code/commands.

**Detection**:
- String concatenation in queries
- eval() or equivalent with user input
- Shell exec with user input

**BEFORE** (vulnerable):
```pseudocode
// SQL injection — user input interpolated into query
database.query("SELECT * FROM users WHERE id = '" + userId + "'")

// Command injection — unsanitized input passed to shell
shell.exec("git clone " + userUrl)

// Code injection — arbitrary code execution
evaluate(userProvidedCode)
```

**AFTER** (secure):
```pseudocode
// Parameterized query — input treated as data, not SQL
database.query("SELECT * FROM users WHERE id = ?", [userId])

// Validated command — allowlist pattern
IF userUrl DOES NOT MATCH pattern "^https://github.com/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+.git$":
    THROW Error("Invalid repository URL")
safeClone(userUrl)

// Never evaluate user input — use safe alternatives like JSON parsing
result = parseJSON(userProvidedJson)
```

## A04: Insecure Design

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
    // No rate limiting — attacker can brute force passwords
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

## A05: Security Misconfiguration

**Problem**: Insecure default configurations.

**Detection**:
- Open CORS
- Missing security headers
- Debug mode in production

**BEFORE** (vulnerable):
```pseudocode
// Open CORS — any origin can make requests
setCORS(origin="*")

// No security headers — browser protections disabled
server.start(port=3000)
```

**AFTER** (secure):
```pseudocode
// Restricted CORS — only trusted origins
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

## A06: Vulnerable Components

**Problem**: Using components with known vulnerabilities.

**Detection**:
- Outdated dependencies
- Known CVEs in packages
- Missing lock file

**Fix pattern**:
```pseudocode
// Regular security audits (use your package manager's audit command)
packageManager audit

// Update dependencies
packageManager update

// Use lock files and exact versions
packageManager install --frozen-lockfile
```

## A07: Authentication Failures

**Problem**: Weak authentication mechanisms.

**Detection**:
- Weak password requirements
- Predictable session tokens
- Missing session invalidation

**BEFORE** (vulnerable):
```pseudocode
// Predictable session — user ID as token
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

## A08: Data Integrity Failures

**Problem**: Trusting untrusted data without verification.

**Detection**:
- No signature verification
- Deserializing untrusted data
- Missing input validation

**BEFORE** (vulnerable):
```pseudocode
// No JWT verification — just decode and trust
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

## A09: Logging Failures

**Problem**: Missing or insecure logging.

**Detection**:
- Sensitive data in logs
- Missing auth event logging
- Logs accessible publicly

**BEFORE** (vulnerable):
```pseudocode
// Sensitive data in logs — password and token exposed
log("Login attempt:", { email, password, token })

// No audit trail
createUser(userData)
```

**AFTER** (secure):
```pseudocode
// Safe logging — only non-sensitive fields
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

## A10: SSRF (Server-Side Request Forgery)

**Problem**: Server makes requests to user-controlled URLs.

**Detection**:
- HTTP request with user-provided URL
- No URL validation
- Access to internal network

**BEFORE** (vulnerable):
```pseudocode
// User-controlled URL — can target internal services
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
