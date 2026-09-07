# Request Tracing

Pattern for assigning request IDs, injecting a scoped logger, and logging request completion with timing.

## Data Structure

```pseudocode
RequestTrace:
    requestId = string
    log = Logger (scoped to this requestId)
    timing:
        start = timestamp (milliseconds)
        elapsed() -> milliseconds since start
```

## createTrace

```pseudocode
function createTrace(request):
    requestId = request.headers["x-request-id"] or generateUniqueId()
    startTime = currentTimeMs()

    return {
        requestId: requestId,
        log: logger.withRequestId(requestId),
        timing: {
            start: startTime,
            elapsed: () => currentTimeMs() - startTime
        }
    }
```

## tracedHandler

Wraps a request handler with automatic tracing: logs start, success with status/duration, or failure with error/duration.

```pseudocode
function tracedHandler(request, handler):
    trace = createTrace(request)
    path = parseURL(request.url).pathname

    trace.log.info("Request started", {
        method: request.method,
        path: path
    })

    try:
        response = handler(request, trace)

        trace.log.info("Request completed", {
            method: request.method,
            path: path,
            status: response.status,
            durationMs: trace.timing.elapsed()
        })

        return response

    catch error:
        trace.log.error("Request failed", {
            method: request.method,
            path: path,
            error: error.message if error is Error else "Unknown",
            durationMs: trace.timing.elapsed()
        })
        throw error
```
