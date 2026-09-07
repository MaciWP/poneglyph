---
parent: meta-create
name: examples
description: Three worked examples of generated rules (error handling, API patterns, test conventions).
---

# Worked Examples

## Contents

- [Example 1: Error Handling Convention (Always-On)](#example-1-error-handling-convention-always-on)
- [Patterns](#patterns)
- [Anti-Patterns](#anti-patterns)
- [Exceptions](#exceptions)
- [Example 2: API Endpoint Patterns (Path-Scoped)](#example-2-api-endpoint-patterns-path-scoped)
- [Patterns](#patterns)
- [Status Code Guide](#status-code-guide)
- [Anti-Patterns](#anti-patterns)
- [Example 3: Test Conventions (Path-Scoped)](#example-3-test-conventions-path-scoped)
- [Patterns](#patterns)
- [Anti-Patterns](#anti-patterns)

Three complete rules that show the shape of a finished file for each scope.

## Example 1: Error Handling Convention (Always-On)

```
/meta-create rule error-handling always-on
```

**Creates**: `.claude/rules/error-handling.md`

```markdown
# Error Handling

Typed error handling conventions. Never throw raw strings or untyped errors.

## Patterns

| Pattern | When | Example |
|---------|------|---------|
| Use typed errors | Any error thrown | `throw new AppError("NOT_FOUND", "User not found")` |
| Use Result type | Functions that can fail | `function parse(): Result<T, ParseError>` |
| Wrap at boundaries | External library errors | `catch (e) { throw AppError.from(e) }` |
| Always include code | Creating errors | `new AppError(code, message, cause?)` |

## Anti-Patterns

| Avoid | Use Instead | Reason |
|-------|-------------|--------|
| `throw new Error("msg")` | `throw new AppError(code, msg)` | Untyped errors lose classification |
| `throw "something"` | `throw new AppError(code, msg)` | String throws have no stack trace |
| `catch (e) { /* ignore */ }` | `catch (e) { log.error(e); throw }` | Silent failures hide bugs |
| Broad `catch (e: any)` | Narrow `catch (e: AppError)` | Catches unrelated errors |

## Exceptions

| Exception | Context | Handling |
|-----------|---------|----------|
| Third-party callbacks | Library expects untyped throw | Wrap in typed error at boundary |
| Process exit handlers | `process.on("uncaughtException")` | Log and terminate gracefully |
```

## Example 2: API Endpoint Patterns (Path-Scoped)

```
/meta-create rule api-patterns path-scoped
```

**Creates**: `.claude/rules/paths/api-patterns.md`

```markdown
---
paths:
  - src/api/**/*.ts
  - src/routes/**/*.ts
---

# API Endpoint Patterns

Conventions for REST API endpoints in this project.

## Patterns

| Pattern | Example |
|---------|---------|
| Validate all inputs with schema | `const data = Schema.parse(body)` |
| Return consistent error format | `{ error: { code, message, details? } }` |
| Use proper HTTP status codes | 201 for creation, 204 for deletion |
| Include request ID in responses | `res.header("X-Request-Id", id)` |

## Status Code Guide

| Action | Success | Client Error | Not Found |
|--------|---------|-------------|-----------|
| GET item | 200 | 400 | 404 |
| GET list | 200 | 400 | - |
| POST create | 201 | 400/422 | - |
| PUT update | 200 | 400/422 | 404 |
| DELETE | 204 | 400 | 404 |

## Anti-Patterns

| Avoid | Use Instead |
|-------|-------------|
| Raw body access without validation | Schema validation (Zod, Valibot) |
| Generic 500 for all errors | Specific error codes per failure type |
| Returning stack traces to client | Log internally, return safe message |
| Inline validation logic | Reusable schema definitions |
```

## Example 3: Test Conventions (Path-Scoped)

```
/meta-create rule test-conventions path-scoped
```

**Creates**: `.claude/rules/paths/test-conventions.md`

```markdown
---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/test/**"
---

# Test Conventions

Standards for test files in this project.

## Patterns

| Pattern | Example |
|---------|---------|
| Use describe/it structure | `describe("UserService", () => { it("creates user", ...) })` |
| One assertion per test (prefer) | Each `it` block tests one behavior |
| Name tests as behaviors | `"returns 404 when user not found"` |
| Clean up after tests | `afterEach(() => cleanup())` |

## Anti-Patterns

| Avoid | Use Instead |
|-------|-------------|
| Mocking the database | Real database with test fixtures |
| Testing implementation details | Test public behavior and outputs |
| Shared mutable state between tests | Fresh setup in beforeEach |
| Skipped tests without reason | `it.skip("reason: ...")` or remove |
```
