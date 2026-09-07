# Diagnostic Service

## Contents

- [Data Structures](#data-structures)
- [DiagnosticService](#diagnosticservice)

Complete service pattern that orchestrates error diagnosis, stack analysis, root cause analysis, and report generation.

## Data Structures

```pseudocode
DiagnosticContext:
    requestId = string (optional)
    userId = string (optional)
    endpoint = string (optional)
    method = string (optional)
    input = any (optional)
    environment:
        runtime = string          // e.g., language version
        platform = string         // e.g., OS
        memoryUsage = object      // Runtime-specific memory stats
    timestamp = ISO 8601 string

DiagnosticReport:
    id = unique identifier
    error = ErrorDiagnosis        // From error-diagnosis.md
    stackAnalysis = StackAnalysis // From stack-trace-analysis.md
    context = DiagnosticContext
    rootCause = RootCauseAnalysis (optional)  // From 5-whys-analysis.md
    recommendations = list of strings
```

## DiagnosticService

```pseudocode
DiagnosticService:
    reports = Map<id, DiagnosticReport>

    function diagnose(error, context = {}):
        id = generateUniqueId()

        fullContext = {
            ...context,
            environment: {
                runtime: getRuntimeVersion(),
                platform: getPlatform(),
                memoryUsage: getMemoryUsage()
            },
            timestamp: now().toISO8601()
        }

        diagnosis = diagnoseError(error, context.input)
        stackAnalysis = analyzeStackTrace(error.stack or "")

        report = {
            id: id,
            error: diagnosis,
            stackAnalysis: stackAnalysis,
            context: fullContext,
            recommendations: generateRecommendations(diagnosis, stackAnalysis)
        }

        reports.set(id, report)
        return report

    function addRootCauseAnalysis(reportId, answers, evidence = []):
        report = reports.get(reportId)
        if not report: return null

        report.rootCause = analyze5Whys(
            report.error.message,
            answers,
            evidence
        )

        return report

    function generateRecommendations(diagnosis, stackAnalysis):
        recommendations = copy(diagnosis.suggestions)

        if stackAnalysis.originatingFrame:
            frame = stackAnalysis.originatingFrame
            recommendations.add("Review code at {frame.file}:{frame.line}")

            // Optionally read source context around the failing line
            sourceContext = readFileLines(frame.file, frame.line - 3, frame.line + 2)
            if sourceContext:
                recommendations.add("Relevant code context:\n{sourceContext}")

        if diagnosis.severity == CRITICAL:
            recommendations.prepend("CRITICAL: Immediate attention required")
            recommendations.add("Consider rolling back recent changes")

        return recommendations

    function formatReport(report):
        output = []
        output.add("# Diagnostic Report")
        output.add("**Report ID**: {report.id}")
        output.add("**Timestamp**: {report.context.timestamp}")
        output.add("")
        output.add("## Error Summary")
        output.add("| Field | Value |")
        output.add("|-------|-------|")
        output.add("| Type | {report.error.type} |")
        output.add("| Message | {report.error.message} |")
        output.add("| Severity | {report.error.severity} |")

        if report.error.code:
            output.add("| Code | {report.error.code} |")
        if report.error.status:
            output.add("| Status | {report.error.status} |")
        if report.stackAnalysis.originatingFrame:
            frame = report.stackAnalysis.originatingFrame
            output.add("| Location | `{frame.file}:{frame.line}` |")
            output.add("| Function | `{frame.function}` |")

        output.add(formatStackAnalysis(report.stackAnalysis))

        if report.context.requestId:
            output.add("## Request Context")
            output.add("- **Request ID**: {report.context.requestId}")
            if report.context.endpoint:
                output.add("- **Endpoint**: {report.context.method or 'GET'} {report.context.endpoint}")
            if report.context.userId:
                output.add("- **User ID**: {report.context.userId}")

        if report.rootCause:
            output.add("## 5 Whys Analysis")
            for each why in report.rootCause.whys:
                output.add("**{why.level}. {why.question}**")
                output.add("> {why.answer}")
                if why.evidence:
                    output.add("> *Evidence: {why.evidence}*")

            output.add("**Root Cause**: {report.rootCause.rootCause}")

        output.add("## Recommendations")
        for each rec in report.recommendations:
            output.add("- {rec}")

        return join(output, "\n")
```
