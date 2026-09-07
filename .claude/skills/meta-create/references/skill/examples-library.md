---
parent: meta-create
name: examples-library
description: Full worked examples for reference, workflow, and research skill types
---

# Worked Examples

## Contents

- [Example 1: API Conventions (Reference / knowledge-base)](#example-1-api-conventions-reference-knowledge-base)
- [When to Use](#when-to-use)
- [Patterns](#patterns)
- [Checklist](#checklist)
- [Anti-Patterns](#anti-patterns)
- [References](#references)
- [Example 2: Deploy (Workflow)](#example-2-deploy-workflow)
- [Usage](#usage)
- [Prerequisites](#prerequisites)
- [Steps](#steps)
- [Output — Success](#output-success)
- [Error Handling](#error-handling)
- [Rollback](#rollback)
- [Example 3: Architecture Analysis (Research / reference)](#example-3-architecture-analysis-research-reference)
- [Methodology](#methodology)
- [Research Areas](#research-areas)
- [Output Format](#output-format)
- [Constraints](#constraints)

Complete, minimally-trimmed examples of generated skills. Read this to see end-to-end what a finished skill looks like for each type.

## Example 1: API Conventions (Reference / knowledge-base)

```
/meta-create skill api-conventions reference
```

**Creates**: `.claude/skills/api-conventions/SKILL.md`

```yaml
---
name: api-conventions
description: |
  REST API design patterns and conventions for this project.
  Use when: creating or modifying API endpoints, routes, or handlers.
  Keywords - api, rest, endpoint, route, handler, validation
type: knowledge-base
disable-model-invocation: false
argument-hint: "[endpoint-path]"
effort: low
activation:
  keywords:
    - api
    - rest
    - endpoint
    - route
for_agents: [builder, reviewer]
version: "1.0"
---

# API Conventions

Standard patterns for REST API development in this project.

## When to Use

Use this skill when:
- Creating new API endpoints
- Modifying existing routes
- Reviewing API code

## Patterns

### Request Validation

All endpoints must validate input using Zod schemas.

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
});

app.post('/api/users', async ({ body }) => {
  const validated = CreateUserSchema.parse(body);
  // ... implementation
});
```

### Error Responses

Use consistent error format across all endpoints.

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

## Checklist

- [ ] Input validated with Zod schema
- [ ] Consistent error format
- [ ] Proper HTTP status codes
- [ ] OpenAPI documentation updated

## Anti-Patterns

| Avoid | Instead |
|-------|---------|
| Raw body access | Use validation schema |
| Generic 500 errors | Specific error codes |
| Inline validation | Reusable schemas |

## References

- [Elysia Validation](https://elysiajs.com/validation)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

---

**Version**: 1.0.0
```

## Example 2: Deploy (Workflow)

```
/meta-create skill deploy workflow
```

**Creates**: `.claude/skills/deploy/SKILL.md`

```yaml
---
name: deploy
description: |
  Deploy application to specified environment.
  Use when: deploying, releasing, pushing to staging or production.
  Keywords - deploy, release, staging, production, rollout
type: workflow
disable-model-invocation: true
argument-hint: "[environment] [--dry-run?]"
effort: medium
activation:
  keywords:
    - deploy
    - release
    - staging
    - production
for_agents: [builder]
version: "1.0"
---

# Deploy Application

Deploy the application to staging or production environment.

## Usage

```
/deploy <environment> [--dry-run]
```

## Prerequisites

- [ ] All tests passing
- [ ] No uncommitted changes
- [ ] Environment variables configured

## Steps

### Step 1: Verify Clean State
```bash
git status --porcelain
bun test
```

### Step 2: Build Application
```bash
bun run build
```

### Step 3: Run Migrations
```bash
bun run migrate --env={environment}
```

### Step 4: Deploy
```bash
bun run deploy:{environment}
```

### Step 5: Verify
```bash
curl -f https://{environment}.example.com/health
```

## Output — Success
```
Deploy completed successfully
Environment: {environment}
Version: {git-sha}
URL: https://{environment}.example.com
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| Tests failing | Code issues | Fix tests before deploy |
| Build failed | Compilation error | Check build logs |
| Migration failed | Schema conflict | Review migration files |
| Health check failed | App not starting | Check logs, rollback |

## Rollback

1. Run `/deploy-rollback {environment}`
2. Check logs for root cause
3. Fix issue and redeploy

---

**Version**: 1.0.0
```

## Example 3: Architecture Analysis (Research / reference)

```
/meta-create skill arch-analysis research
```

**Creates**: `.claude/skills/arch-analysis/SKILL.md`

```yaml
---
name: arch-analysis
description: |
  Analyze codebase architecture patterns and structure.
  Use when: asked about architecture, module structure, or design decisions.
  Keywords - architecture, structure, modules, design, patterns, analysis
type: reference
disable-model-invocation: false
argument-hint: "[module-or-path]"
effort: high
activation:
  keywords:
    - architecture
    - structure
    - modules
    - design patterns
for_agents: [planner, scout]
version: "1.0"
---

# Architecture Analysis

Research and analyze codebase architecture patterns.

## Methodology

1. **Codebase First**: Search local files using Read, Grep, Glob
2. **Structure Analysis**: Map module dependencies and layers
3. **Pattern Recognition**: Identify architectural patterns used
4. **Summarize**: Present findings with confidence assessment

## Research Areas

### Area 1: Module Structure
- What is the high-level directory structure?
- How are modules organized (by feature, layer, both)?
- What are the main entry points?

### Area 2: Dependencies
- What are the core dependencies?
- How do modules depend on each other?
- Are there any circular dependencies?

### Area 3: Patterns
- What architectural patterns are used?
- How is state managed?
- How is configuration handled?

## Output Format

### Findings from Codebase

| Finding | Source | Confidence |
|---------|--------|------------|
| Uses layered architecture | `src/` structure | High |
| DI pattern for services | `container.ts:45` | High |

### Patterns Identified

| Pattern | Usage | Example |
|---------|-------|---------|
| Repository | Data access | `src/data/userRepo.ts` |
| Service Layer | Business logic | `src/services/auth.ts` |

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Structure | High | Clear directory layout |
| Patterns | Medium | Some implicit patterns |

## Constraints

- Always cite sources
- Indicate confidence levels
- Focus on facts from codebase
- Admit when information is not found

---

**Version**: 1.0.0
```
