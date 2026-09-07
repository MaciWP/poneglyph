# Stack Trace Analysis

Parsing and analysis patterns for stack traces.

## Data Structures

```pseudocode
StackFrame:
    function = string
    file = string
    line = number
    column = number
    isInternal = boolean      // Framework/runtime internal frames
    isThirdParty = boolean    // Dependency/library frames

StackAnalysis:
    frames = list of StackFrame
    originatingFrame = StackFrame or null   // First user-code frame
    involvedFiles = list of strings          // Unique user-code files
    errorPath = list of strings              // Reverse call path
```

## analyzeStackTrace

Parses a raw stack trace string into structured StackAnalysis. Separates user frames from internal/third-party frames and identifies the originating frame.

```pseudocode
function analyzeStackTrace(stack):
    lines = stack.split("\n").skip(1)  // Skip error message line
    frames = []

    for each line in lines:
        match = parse line for pattern: "at FUNCTION (FILE:LINE:COLUMN)"
        if match:
            frames.append({
                function: match.function,
                file: match.file,
                line: match.line,
                column: match.column,
                isInternal: match.file starts with runtime prefix (e.g., "node:", "bun:"),
                isThirdParty: match.file contains dependency directory (e.g., "node_modules", "vendor")
            })

    userFrames = filter(frames, f => NOT f.isInternal AND NOT f.isThirdParty)
    involvedFiles = unique(map(userFrames, f => f.file))

    return {
        frames: frames,
        originatingFrame: userFrames[0] or null,
        involvedFiles: involvedFiles,
        errorPath: reverse(map(userFrames, f => "{f.function} ({f.file}:{f.line})"))
    }
```

## formatStackAnalysis

Formats a StackAnalysis into a readable report.

```pseudocode
function formatStackAnalysis(analysis):
    output = "## Stack Trace Analysis\n"

    if analysis.originatingFrame:
        frame = analysis.originatingFrame
        output += "**Origin**: `{frame.function}` at `{frame.file}:{frame.line}`\n"

    output += "### Call Path\n"
    for each step in analysis.errorPath:
        output += "- {step}\n"

    output += "### Involved Files\n"
    for each file in analysis.involvedFiles:
        output += "- `{file}`\n"

    return output
```
