# Error Diagnosis Function

## Contents

- [Data Structure](#data-structure)
- [diagnoseError](#diagnoseerror)
- [addSuggestions](#addsuggestions)

Core function for analyzing errors and generating actionable suggestions.

## Data Structure

```pseudocode
ErrorDiagnosis:
    type = string               // e.g., "TypeError", "SyntaxError"
    message = string
    code = string (optional)    // e.g., "ECONNREFUSED"
    status = number (optional)  // e.g., 401, 500
    stack = list of strings     // Stack trace lines
    context:
        file = string (optional)
        line = number (optional)
        column = number (optional)
        function = string (optional)
        input = any (optional)
    suggestions = list of strings
    severity = LOW | MEDIUM | HIGH | CRITICAL
```

## diagnoseError

Analyzes an unknown error and produces a structured ErrorDiagnosis with context, suggestions, and severity.

```pseudocode
function diagnoseError(error, input = null):
    if error is not an Error instance:
        return {
            type: "Unknown",
            message: toString(error),
            stack: [],
            context: { input },
            suggestions: ["Convert to Error instance for better debugging"],
            severity: MEDIUM
        }

    stackLines = error.stack.split("\n").skip(1)  // Skip error message line
    firstFrame = parse stackLines[0] for pattern: "at FUNCTION (FILE:LINE:COLUMN)"

    diagnosis = {
        type: error.constructorName,
        message: error.message,
        code: error.code (if present),
        status: error.status (if present),
        stack: stackLines[0..9],  // First 10 frames
        context: {
            function: firstFrame.function,
            file: firstFrame.file,
            line: firstFrame.line,
            column: firstFrame.column,
            input: input
        },
        suggestions: [],
        severity: MEDIUM
    }

    addSuggestions(diagnosis)
    return diagnosis
```

## addSuggestions

Enriches an ErrorDiagnosis with type-specific suggestions and adjusts severity.

```pseudocode
function addSuggestions(diagnosis):
    type = diagnosis.type
    message = diagnosis.message
    code = diagnosis.code
    status = diagnosis.status

    if type == "TypeError" AND message contains "undefined":
        diagnosis.suggestions.add(
            "Use optional chaining (?.) for nested property access",
            "Add null checks before accessing properties",
            "Verify data is loaded before accessing"
        )
        diagnosis.severity = HIGH

    if type == "SyntaxError":
        diagnosis.suggestions.add(
            "Check for missing brackets, quotes, or semicolons",
            "Run linter to detect syntax issues",
            "Review recent code changes"
        )
        diagnosis.severity = CRITICAL

    if code == "ECONNREFUSED":
        diagnosis.suggestions.add(
            "Verify the target service is running",
            "Check the port number is correct",
            "Verify no firewall is blocking the connection"
        )
        diagnosis.severity = HIGH

    if status == 401:
        diagnosis.suggestions.add(
            "Check if token is expired",
            "Verify authentication credentials",
            "Refresh the auth token"
        )

    if status == 429:
        diagnosis.suggestions.add(
            "Implement rate limiting on client side",
            "Add exponential backoff",
            "Check API rate limit headers"
        )
```
