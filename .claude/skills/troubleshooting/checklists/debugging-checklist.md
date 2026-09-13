# Debugging Checklist

## Error Analysis

- [ ] Identify error type (Syntax, Type, Runtime, Network, Database, Auth, Business, Memory, Async)
- [ ] Extract complete error message
- [ ] Analyze stack trace to identify origin
- [ ] Verify if reproducible
- [ ] Capture context (request, user, input)

## Root Cause Analysis

- [ ] Apply 5 Whys method
- [ ] Document evidence for each "Why"
- [ ] Identify actual root cause (not symptoms)
- [ ] Define preventive measures
- [ ] Verify the fix addresses root cause

## Logging

- [ ] Structured logs in JSON format
- [ ] Request ID present in all logs
- [ ] Timestamps in ISO 8601
- [ ] Relevant context without sensitive data
- [ ] Complete stack trace for errors

## Debugging Techniques

- [ ] Reproduce locally if possible
- [ ] Binary search for intermittent issues
- [ ] Diff debugging for regressions
- [ ] Verify environment configuration
- [ ] Review recent changes (version control history)

## Post-Mortem

- [ ] Document incident timeline
- [ ] Identify impact (affected users, duration)
- [ ] Document applied fix
- [ ] Add tests to prevent recurrence
- [ ] Update runbooks if applicable

## Retry Implementation

- [ ] Identify all transient failure points
- [ ] Classify errors as transient vs permanent
- [ ] Define appropriate retry values (not too aggressive)
- [ ] Consider rate limits of external services
- [ ] Use exponential backoff (not linear)
- [ ] Add jitter to prevent thundering herd
- [ ] Implement circuit breaker for external services
- [ ] Add timeouts to all network calls
- [ ] Only retry transient errors
- [ ] Respect Retry-After headers
- [ ] Log all retry attempts
- [ ] Monitor circuit breaker state

## Recovery / Saga Implementation

- [ ] Identify all failure points in the workflow
- [ ] Define compensation actions for each step
- [ ] Each step has execute and compensate
- [ ] Compensations execute in reverse order
- [ ] Handle compensation failures (log + alert)
- [ ] Consider retries for transient steps
- [ ] Detailed logging at each step
- [ ] Define idempotency strategy

## DLQ Implementation

- [ ] Max retries configured appropriately
- [ ] Exponential backoff between retries
- [ ] Alerts for new DLQ entries
- [ ] API/UI to inspect DLQ
- [ ] Process to reprocess DLQ items

## Checkpoint Implementation

- [ ] Checkpoints persisted to durable storage
- [ ] TTL defined for checkpoints
- [ ] Automatic resume on restart
- [ ] Cleanup of completed checkpoints
- [ ] Monitoring for stalled workflows

## Post-Recovery

- [ ] Log all compensations executed
- [ ] Metrics for recovery success rate
- [ ] Alerts on failed compensations
- [ ] Runbook for manual recovery
- [ ] Tests for recovery scenarios
