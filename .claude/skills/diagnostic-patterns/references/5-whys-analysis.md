# 5 Whys Analysis

Root cause analysis technique that drills down through layers of causation.

## Data Structures

```pseudocode
WhyAnalysis:
    level = number         // 1 through 5
    question = string      // "Why did X happen?"
    answer = string
    evidence = string (optional)

RootCauseAnalysis:
    problem = string
    whys = list of WhyAnalysis
    rootCause = string
    preventiveMeasures = list of strings
```

## analyze5Whys

Takes a problem statement, a list of answers (each answering "why" for the previous), and optional evidence. Returns a structured RootCauseAnalysis.

```pseudocode
function analyze5Whys(problem, answers, evidence = []):
    whys = []

    for index, answer in enumerate(answers):
        question = (index == 0)
            ? "Why did {problem}?"
            : "Why {answers[index - 1]}?"

        whys.append({
            level: index + 1,
            question: question,
            answer: answer,
            evidence: evidence[index] (if present)
        })

    return {
        problem: problem,
        whys: whys,
        rootCause: last(answers),
        preventiveMeasures: generatePreventiveMeasures(last(answers))
    }
```

## generatePreventiveMeasures

Generates preventive measures based on root cause keywords.

```pseudocode
function generatePreventiveMeasures(rootCause):
    measures = []

    if rootCause contains "test":
        measures.add("Add integration tests for edge cases")
        measures.add("Implement test coverage requirements")

    if rootCause contains "validation":
        measures.add("Add input validation layer")
        measures.add("Enable strict type checking")

    if rootCause contains "null" or "undefined":
        measures.add("Enable strict null checks")
        measures.add("Use optional chaining consistently")

    if rootCause contains "timeout" or "network":
        measures.add("Implement circuit breaker pattern")
        measures.add("Add retry logic with backoff")

    if measures is empty:
        measures.add("Document and monitor for recurrence")

    return measures
```

## Usage Example

```pseudocode
analysis = analyze5Whys(
    problem: "API returned 500 error",
    answers: [
        "Database query failed",
        "Connection pool was exhausted",
        "Too many concurrent requests during peak",
        "No connection pooling limit was configured",
        "Production config was not reviewed for scale"
    ],
    evidence: [
        "Error log: 'ConnectionError'",
        "Pool stats: 100/100 connections used",
        "Metrics: 500 req/s vs normal 50 req/s",
        "Config file: pool.max = 100 (default)",
        "No load testing performed before launch"
    ]
)
```
