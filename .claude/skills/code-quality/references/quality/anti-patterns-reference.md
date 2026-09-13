# Anti-Patterns Reference

## Contents

- [Anti-Patterns Table](#anti-patterns-table)
- [Detailed Descriptions](#detailed-descriptions)

Common anti-patterns with detection and fixes, applicable to any language or framework.

## Anti-Patterns Table

| Anti-Pattern | Problem | Detection | Fix |
|--------------|---------|-----------|-----|
| God Class | Does everything | > 500 lines, many responsibilities | Split by responsibility |
| Spaghetti Code | No clear structure | Goto-like jumps, deep nesting | Refactor with clear flow |
| Shotgun Surgery | One change = many files | Feature touches 5+ files | Consolidate related code |
| Primitive Obsession | Primitives instead of objects | Repeated string/number patterns | Create value objects |
| Data Clumps | Same params everywhere | 3+ params repeated together | Extract parameter object |
| Switch Statements | Type checking switches | switch on type/enum | Polymorphism/strategy |
| Speculative Generality | YAGNI violation | Unused abstractions | Remove until needed |
| Dead Code | Never executed | Unreachable branches | Delete it |

## Detailed Descriptions

### God Class

A class that knows too much or does too much. Typically has hundreds of methods and fields spanning multiple concerns.

**Signs**:
- More than 500 lines
- Methods that don't use instance state
- Unrelated methods grouped together
- Many dependencies injected

**Fix**: Identify distinct responsibilities and extract into separate classes. Use composition over inheritance.

### Shotgun Surgery

When a single logical change requires modifications across many files. The opposite of high cohesion.

**Signs**:
- Adding a field requires changes in 5+ files
- Feature additions touch UI, service, repository, types, and tests
- No clear module boundary

**Fix**: Group related code by feature/domain rather than by technical layer. Use vertical slice architecture where appropriate.

### Primitive Obsession

Using primitive types (string, number) for domain concepts that deserve their own type.

**Signs**:
- Repeated validation of the same string format (email, phone, UUID)
- Passing around raw strings that represent specific domain concepts
- Multiple functions accepting the same group of primitives

**Fix**:

```pseudocode
// BAD: Primitive obsession
function sendEmail(to, from, subject):
    // validation scattered everywhere
    ...

// GOOD: Value objects
class EmailAddress:
    constructor(value):
        if not isValidEmail(value):
            throw ValidationError("Invalid email")
        this.value = value

    function toString() -> string:
        return this.value

function sendEmail(to: EmailAddress, from: EmailAddress, subject):
    // validation already handled by EmailAddress constructor
    ...
```

### Data Clumps

Groups of data that frequently appear together in parameters, fields, or returns.

**Signs**:
- Same 3+ parameters passed to multiple functions
- Related fields always used together
- Parallel arrays of related data

**Fix**:

```pseudocode
// BAD: Data clump
function createEvent(startDate, endDate, timezone) ...
function updateEvent(startDate, endDate, timezone) ...
function validateEvent(startDate, endDate, timezone) ...

// GOOD: Extract parameter object
structure DateRange:
    startDate, endDate, timezone

function createEvent(range: DateRange) ...
function updateEvent(range: DateRange) ...
function validateEvent(range: DateRange) ...
```

### Speculative Generality

Creating abstractions, interfaces, or extension points "just in case" they might be needed in the future.

**Signs**:
- Abstract classes with only one subclass
- Interfaces implemented by only one class
- Unused method parameters "for future use"
- Configuration options nobody changes

**Fix**: Follow YAGNI (You Ain't Gonna Need It). Add abstraction when you have a concrete second use case, not before.
