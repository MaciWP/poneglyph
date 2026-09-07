---
name: {{SKILL_NAME}}
description: {{DESCRIPTION}}
disable-model-invocation: true
argument-hint: [{{ARG1}}] [{{ARG2}}]
allowed-tools: {{TOOLS}}
---

# {{SKILL_TITLE}}

{{Purpose of this workflow}}

## Usage

```
/{{SKILL_NAME}} {{arguments}}
```

**Examples**:
```
/{{SKILL_NAME}} example1
/{{SKILL_NAME}} example2 --flag
```

---

## Prerequisites

Before running:
- [ ] {{Prerequisite 1}}
- [ ] {{Prerequisite 2}}

---

## Steps

### Step 1: {{Action Title}}

{{Detailed instructions}}

```bash
{{Command if applicable}}
```

### Step 2: {{Action Title}}

{{Detailed instructions}}

### Step 3: {{Action Title}}

{{Detailed instructions}}

### Step 4: Verify

{{Verification steps}}

---

## Output

### Success

```
✅ {{Success message}}

{{Expected output}}
```

### Failure

```
❌ {{Failure message}}

{{Error details}}
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| {{Error 1}} | {{Cause}} | {{Solution}} |
| {{Error 2}} | {{Cause}} | {{Solution}} |

---

## Rollback

If something goes wrong:

1. {{Rollback step 1}}
2. {{Rollback step 2}}

---

**Version**: 1.0.0
