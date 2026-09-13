# Pattern: Manual Rollback with Compensation

Execute a sequence of operations, and if any fails, run compensation actions in reverse order.

## When to Use

- Multi-step operations across different resources
- Operations that cannot use a single DB transaction
- Steps that have clear undo/compensate actions

## Core Concept

```pseudocode
Operation:
    name = string
    execute() -> result
    compensate() -> void
```

## Implementation

```pseudocode
function executeWithRollback(operations):
    completed = []
    lastResult = null

    try:
        for each op in operations:
            log("Executing: {op.name}")
            lastResult = op.execute()
            completed.append(op)

        return { success: true, data: lastResult }

    catch error:
        failedOp = operations[length(completed)]
        log("Operation failed at: {failedOp.name}")

        // Rollback in reverse order
        for each op in reverse(completed):
            try:
                log("Compensating: {op.name}")
                op.compensate()
            catch compensateError:
                log("CRITICAL: Compensation failed for {op.name}: {compensateError}")
                // Alert system - manual intervention needed

        return {
            success: false,
            failedAt: failedOp.name,
            error: error
        }
```

## Usage Example

```pseudocode
function createUserWithProfile(userData, profileData):
    userId = null
    profileId = null

    operations = [
        {
            name: "Create User",
            execute: () =>
                userId = db.insert("users", userData)
                return userId,
            compensate: () =>
                if userId: db.delete("users", userId)
        },
        {
            name: "Create Profile",
            execute: () =>
                profileId = db.insert("profiles", {userId, ...profileData})
                return profileId,
            compensate: () =>
                if profileId: db.delete("profiles", profileId)
        },
        {
            name: "Send Welcome Email",
            execute: () =>
                emailService.sendWelcome(userId),
            compensate: () =>
                log("Email already sent - no compensation available")
        }
    ]

    return executeWithRollback(operations)
```

## Key Points

- Compensations execute in **reverse order** of completed operations
- Each compensation must handle its own errors (never throw)
- Some operations have no compensation (e.g., sent emails) - log and accept
- Track `completed` operations to know what needs rollback
