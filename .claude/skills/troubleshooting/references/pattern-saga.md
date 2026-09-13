# Pattern: Saga Orchestrator

## Contents

- [When to Use](#when-to-use)
- [Core Concept](#core-concept)
- [Saga Orchestrator](#saga-orchestrator)
- [Usage Example](#usage-example)
- [Key Points](#key-points)

Orchestrate multi-step distributed operations with automatic compensation on failure.

## When to Use

- Cross-service transactions (payment + inventory + shipping)
- Operations where each step talks to a different service/resource
- Need structured retry + compensation logic

## Core Concept

```pseudocode
SagaStep:
    name = string
    execute(context) -> updatedContext
    compensate(context) -> updatedContext
    retryable = boolean (optional)
    maxRetries = number (optional)
```

## Saga Orchestrator

```pseudocode
Saga:
    steps = []
    onStepCompleteCallback = null
    onStepFailCallback = null

    function addStep(step):
        steps.append(step)
        return self  // Builder pattern

    function execute(initialContext):
        context = copy(initialContext)
        completedSteps = []

        try:
            for each step in steps:
                log("[Saga] Executing step: {step.name}")

                if step.retryable:
                    context = executeWithRetry(step, context)
                else:
                    context = step.execute(context)

                completedSteps.append(step)
                onStepCompleteCallback?(step.name, context)

            return {
                success: true,
                context: context,
                completedSteps: names(completedSteps)
            }

        catch error:
            failedStep = steps[length(completedSteps)]
            log("[Saga] Failed at step: {failedStep.name}")
            onStepFailCallback?(failedStep.name, error)

            // Compensate in reverse order
            log("[Saga] Starting compensation...")
            for each step in reverse(completedSteps):
                try:
                    log("[Saga] Compensating: {step.name}")
                    context = step.compensate(context)
                catch compensateError:
                    log("[Saga] CRITICAL: Compensation failed for {step.name}")
                    handleCompensationFailure(step.name, compensateError, context)

            return {
                success: false,
                context: context,
                completedSteps: names(completedSteps),
                failedStep: failedStep.name,
                error: error
            }

    function executeWithRetry(step, context):
        maxRetries = step.maxRetries or 3
        lastError = null

        for attempt = 0 to maxRetries - 1:
            try:
                return step.execute(context)
            catch error:
                lastError = error
                if attempt < maxRetries - 1:
                    delay = 2^attempt * 1000
                    log("[Saga] Retry {attempt+1}/{maxRetries} for {step.name} after {delay}ms")
                    sleep(delay)

        throw lastError

    function handleCompensationFailure(stepName, error, context):
        log({
            type: "COMPENSATION_FAILURE",
            step: stepName,
            error: error.message,
            context: context,
            timestamp: now()
        })
        // In production: send to alerting system, create incident ticket
```

## Usage Example

```pseudocode
orderSaga = new Saga()
    .addStep({
        name: "Reserve Inventory",
        execute: (ctx) =>
            reservationId = inventoryService.reserve(ctx.items)
            return {...ctx, reservationId},
        compensate: (ctx) =>
            if ctx.reservationId:
                inventoryService.release(ctx.reservationId)
            return ctx
    })
    .addStep({
        name: "Process Payment",
        execute: (ctx) =>
            paymentId = paymentService.charge(ctx.amount)
            return {...ctx, paymentId},
        compensate: (ctx) =>
            if ctx.paymentId:
                paymentService.refund(ctx.paymentId)
            return ctx,
        retryable: true,
        maxRetries: 3
    })
    .addStep({
        name: "Create Shipment",
        execute: (ctx) =>
            shipmentId = shippingService.create(ctx.address, ctx.items)
            return {...ctx, shipmentId},
        compensate: (ctx) =>
            if ctx.shipmentId:
                shippingService.cancel(ctx.shipmentId)
            return ctx
    })

result = orderSaga.execute({
    customerId: "cust-123",
    items: orderItems,
    amount: totalAmount,
    address: shippingAddress
})
```

## Key Points

- Context flows through each step, accumulating results
- Failed steps trigger compensation in reverse order
- `retryable` steps get exponential backoff before failing
- Compensation failures are logged but don't stop other compensations
- Builder pattern (`addStep().addStep()`) for fluent configuration
