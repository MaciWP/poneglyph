# Pattern: Checkpoint/Resume Workflow

## Contents

- [When to Use](#when-to-use)
- [Core Concept](#core-concept)
- [ResumableWorkflow](#resumableworkflow)
- [Storage Implementation Example](#storage-implementation-example)
- [Key Points](#key-points)

Persist progress of long-running workflows so they can resume from the last checkpoint after failure.

## When to Use

- Data migrations that process thousands of records
- ETL pipelines that take hours
- Any workflow where re-running from scratch is expensive
- Processes that may be interrupted (deployments, restarts)

## Core Concept

```pseudocode
Checkpoint:
    id = unique identifier
    workflowId = string
    stepIndex = number
    data = serializable state
    createdAt = timestamp
    expiresAt = timestamp

WorkflowStep:
    name = string
    execute(data) -> updatedData

CheckpointStorage (interface):
    save(checkpoint) -> void
    get(workflowId) -> checkpoint or null
    delete(workflowId) -> void
```

## ResumableWorkflow

```pseudocode
ResumableWorkflow:
    steps = []
    checkpointTTL = 24 hours
    workflowId = string
    storage = CheckpointStorage

    function addStep(step):
        steps.append(step)
        return self

    function execute(initialData):
        // Check for existing checkpoint
        checkpoint = storage.get(workflowId)
        startIndex = 0
        data = initialData
        resumedFromCheckpoint = false

        if checkpoint AND checkpoint.expiresAt > now():
            log("[Workflow] Resuming from checkpoint at step {checkpoint.stepIndex}")
            startIndex = checkpoint.stepIndex
            data = checkpoint.data
            resumedFromCheckpoint = true

        try:
            for i = startIndex to length(steps) - 1:
                step = steps[i]
                log("[Workflow] Executing step {i+1}/{length(steps)}: {step.name}")

                data = step.execute(data)

                // Save checkpoint after each step
                saveCheckpoint(i + 1, data)

            // Workflow complete - clean up checkpoint
            storage.delete(workflowId)

            return {
                success: true,
                data: data,
                completedSteps: length(steps),
                resumedFromCheckpoint: resumedFromCheckpoint
            }

        catch error:
            log("[Workflow] Failed at step {startIndex + 1}: {error}")
            throw error

    function saveCheckpoint(stepIndex, data):
        checkpoint = {
            id: generateUniqueId(),
            workflowId: workflowId,
            stepIndex: stepIndex,
            data: data,
            createdAt: now(),
            expiresAt: now() + checkpointTTL
        }
        storage.save(checkpoint)
```

## Storage Implementation Example

```pseudocode
DatabaseCheckpointStorage implements CheckpointStorage:

    function save(checkpoint):
        db.upsert("checkpoints",
            key: checkpoint.workflowId,
            values: {
                stepIndex: checkpoint.stepIndex,
                data: checkpoint.data,
                expiresAt: checkpoint.expiresAt
            }
        )

    function get(workflowId):
        result = db.select("checkpoints")
            .where(workflowId = workflowId)
            .limit(1)
        return result[0] or null

    function delete(workflowId):
        db.delete("checkpoints")
            .where(workflowId = workflowId)
```

## Key Points

- Checkpoints are saved **after** each successful step
- On resume, workflow skips already-completed steps
- Expired checkpoints are ignored (workflow restarts from beginning)
- Completed workflows clean up their checkpoints
- Storage is pluggable (database, Redis, file system)
- Each step receives and returns the accumulated data
