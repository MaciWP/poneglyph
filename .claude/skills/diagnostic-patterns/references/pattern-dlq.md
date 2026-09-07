# Pattern: Dead Letter Queue (DLQ)

## Contents

- [When to Use](#when-to-use)
- [Core Concept](#core-concept)
- [MessageQueue](#messagequeue)
- [Usage Example](#usage-example)
- [Key Points](#key-points)

Handle message processing failures with retries and a dead letter queue for messages that cannot be processed.

## When to Use

- Asynchronous message/event processing
- Background job queues
- Operations that may fail transiently (network, rate limits)
- Need visibility into permanently failed messages

## Core Concept

```pseudocode
Message:
    id = unique identifier
    payload = any data
    queue = string (queue name)
    createdAt = timestamp
    attempts = number
    lastAttempt = timestamp (optional)
    error = string (optional)

DLQEntry extends Message:
    movedAt = timestamp
    originalQueue = string
    failureReason = string

ProcessResult:
    success = boolean
    error = Error (optional)
    shouldRetry = boolean (optional, defaults to true)

QueueConfig:
    maxAttempts = number (e.g., 5)
    baseDelayMs = number (e.g., 1000)
    maxDelayMs = number (e.g., 60000)
```

## MessageQueue

```pseudocode
MessageQueue:
    queue = []
    dlq = []
    processing = false
    name = string
    config = QueueConfig

    function enqueue(payload):
        message = {
            id: generateUniqueId(),
            payload: payload,
            queue: name,
            createdAt: now(),
            attempts: 0
        }
        queue.append(message)
        log("[Queue:{name}] Enqueued message {message.id}")
        return message.id

    function process(handler):
        if processing: return
        processing = true

        while queue is not empty:
            message = queue.removeFirst()
            message.attempts++
            message.lastAttempt = now()

            log("[Queue:{name}] Processing message {message.id} (attempt {message.attempts})")

            try:
                result = handler(message.payload)

                if NOT result.success:
                    if result.shouldRetry != false:
                        handleFailure(message, result.error or Error("Processing failed"))
                    else:
                        moveToDLQ(message, result.error.message or "Non-retryable failure")
                else:
                    log("[Queue:{name}] Message {message.id} processed successfully")

            catch error:
                handleFailure(message, error)

        processing = false

    function handleFailure(message, error):
        message.error = error.message

        if message.attempts >= config.maxAttempts:
            moveToDLQ(message, "Max attempts ({config.maxAttempts}) exceeded: {error.message}")
            return

        // Calculate delay with exponential backoff
        delay = min(
            config.baseDelayMs * 2^(message.attempts - 1),
            config.maxDelayMs
        )

        log("[Queue:{name}] Requeuing message {message.id} after {delay}ms")
        sleep(delay)
        queue.append(message)

    function moveToDLQ(message, reason):
        dlqEntry = {
            ...message,
            movedAt: now(),
            originalQueue: name,
            failureReason: reason
        }
        dlq.append(dlqEntry)
        log("[Queue:{name}] Message {message.id} moved to DLQ: {reason}")
        alertDLQEntry(dlqEntry)

    function reprocessDLQ(messageId, handler):
        entry = dlq.find(id == messageId)
        if not entry: return false

        log("[Queue:{name}] Reprocessing DLQ message {messageId}")
        try:
            result = handler(entry.payload)
            if result.success:
                dlq.remove(entry)
                return true
        catch error:
            entry.error = error.message
            entry.attempts++
            entry.lastAttempt = now()

        return false

    function getDLQStats():
        return {
            count: length(dlq),
            oldestEntry: dlq[0].movedAt or null
        }
```

## Usage Example

```pseudocode
orderQueue = new MessageQueue("orders", {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 60000
})

// Enqueue
orderQueue.enqueue({ orderId: "ord-123", action: "process" })

// Process
orderQueue.process((payload) =>
    try:
        processOrder(payload)
        return { success: true }
    catch error:
        if error.code == "VALIDATION_ERROR":
            return { success: false, error, shouldRetry: false }
        return { success: false, error }
)
```

## Key Points

- Messages get exponential backoff between retries
- After max attempts, messages move to DLQ
- `shouldRetry: false` sends directly to DLQ (permanent failures)
- DLQ entries can be manually reprocessed
- Stats and inspection APIs for monitoring
