# Structured Logging

JSON-based logging pattern with request context, severity levels, and error capture.

## Data Structure

```pseudocode
StructuredLog:
    level = DEBUG | INFO | WARN | ERROR
    message = string
    timestamp = ISO 8601 string
    context = map of key-value pairs
    error (optional):
        type = string
        message = string
        stack = string (optional)
```

## Logger

```pseudocode
Logger:
    requestId = null (optional)

    function withRequestId(requestId):
        newLogger = new Logger()
        newLogger.requestId = requestId
        return newLogger

    function error(message, error, context = {}):
        log = {
            level: ERROR,
            message: message,
            timestamp: now().toISO8601(),
            context: {
                ...context,
                requestId: requestId
            },
            error: {
                type: error.constructorName,
                message: error.message,
                stack: error.stack
            }
        }
        writeToStderr(toJSON(log))

    function info(message, context = {}):
        log = {
            level: INFO,
            message: message,
            timestamp: now().toISO8601(),
            context: {
                ...context,
                requestId: requestId
            }
        }
        writeToStdout(toJSON(log))

    function debug(message, context = {}):
        if debugModeEnabled():
            log = {
                level: DEBUG,
                message: message,
                timestamp: now().toISO8601(),
                context: {
                    ...context,
                    requestId: requestId
                }
            }
            writeToStdout(toJSON(log))
```
