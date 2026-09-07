---
parent: review-patterns
name: mode-performance
description: Performance mode — bottlenecks, memory leaks, N+1, async patterns, metrics, profiling.
---

# Performance Mode

## Contents

- [When to Use](#when-to-use)
- [Review Checklist](#review-checklist)
- [Red Flags (Performance)](#red-flags-performance)
- [Common Issues](#common-issues)
- [Performance Metrics](#performance-metrics)
- [Runtime-Specific Optimizations](#runtime-specific-optimizations)
- [Output Format](#output-format)
- [Performance Review: [Component]](#performance-review-component)
- [Reference Files](#reference-files)
- [Gotchas](#gotchas)

Performance audit checklist. Language-agnostic patterns applicable to any stack.

## When to Use

- Reviewing performance-critical code
- Investigating slow endpoints (> 200ms p95)
- Checking for memory leaks
- Pre-production performance audit
- Database query optimization
- API response time analysis
- Memory usage growing over time

## Review Checklist

### Database (8 items)

- [ ] No N+1 queries (loops with individual queries)
- [ ] Indexes on WHERE, JOIN, ORDER BY columns
- [ ] Batch operations for bulk inserts/updates
- [ ] Connection pooling configured (max connections)
- [ ] Select only needed columns (no SELECT *)
- [ ] LIMIT on all list queries
- [ ] Transactions for multi-step operations
- [ ] Query execution plans analyzed for slow queries

### API Performance (7 items)

- [ ] Pagination on list endpoints (limit/offset or cursor)
- [ ] Response compression enabled (gzip/brotli)
- [ ] Caching for expensive/static operations
- [ ] Appropriate timeouts on external calls
- [ ] Streaming for large responses
- [ ] ETags for conditional requests
- [ ] Request deduplication for concurrent identical calls

### Memory Management (7 items)

- [ ] No growing collections without bounds
- [ ] Streams used for large data processing
- [ ] Weak references for object-keyed caches (when available)
- [ ] Intervals/timeouts cleared on shutdown
- [ ] Event listeners removed when not needed
- [ ] Large objects released after use
- [ ] No closure memory leaks

### Async Patterns (6 items)

- [ ] No synchronous I/O in request handlers
- [ ] Parallel execution for independent operations
- [ ] No sequential await in loops (use parallel + map)
- [ ] Proper error handling doesn't block
- [ ] Background tasks don't block response
- [ ] Streaming instead of buffering large data

### Runtime-Specific (adapt to your stack)

- [ ] Using runtime-native file APIs when available
- [ ] Using runtime-native process spawning
- [ ] Using native WebSocket support when available
- [ ] Not importing unnecessary polyfills
- [ ] Using runtime-native database drivers when appropriate

## Red Flags (Performance)

| Pattern | Severity | Impact | Detection |
|---------|----------|--------|-----------|
| Query inside a loop | Critical | O(n) queries, 100x slower | Grep for queries in loops |
| Synchronous I/O in request handler | Critical | Blocks all concurrent requests | Grep for sync file/network ops |
| Collection grows without limit | High | Memory leak, OOM crash | Check growing collections |
| `SELECT *` on large tables | High | Excess memory/bandwidth | Check query columns |
| No pagination on list API | High | Unbounded memory | Check list endpoints |
| Sequential await in loop | High | Total time = sum, not max | Check async patterns |
| Missing connection pool | High | Connection exhaustion | Check DB config |
| No response compression | Medium | 3-5x larger responses | Check middleware |
| Serializing large objects | Medium | CPU spike, blocks processing | Check serialization paths |
| Missing indexes | Medium | Full table scans | Check query plans |
| Regex with backtracking | Medium | ReDoS | Check complex regex |
| Debug logging in production | Low | I/O overhead | Grep for debug log calls |

## Common Issues

| Issue | Impact | Key Fix |
|-------|--------|---------|
| N+1 Query | O(n) queries, 100x slower | JOIN or batch loading |
| Synchronous Blocking | Blocks all concurrent requests | Use async I/O |
| Growing Collections | OOM crash | LRU cache with maxEntries + TTL |
| Unbatched Operations | N round trips | Batch insert/update |
| Sequential Await | Total = sum, not max | Parallel execution |
| Unbounded Response | Memory exhaustion | Pagination with LIMIT |
| Missing Indexes | Full table scans | Index WHERE/JOIN/ORDER columns |
| Large Serialization | CPU spike | Stream responses |
| Missing Connection Pool | Connection exhaustion | Pool with max connections |
| Event Listener Leak | Memory leak | Remove on cleanup |

For N+1, sync blocking, unbatched, and sequential await patterns with before/after examples, see `${CLAUDE_SKILL_DIR}/references/performance/n-plus-one-patterns.md`.

For memory leak, event listener, and serialization patterns, see `${CLAUDE_SKILL_DIR}/references/performance/memory-leak-patterns.md`.

## Performance Metrics

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| API Response Time (p95) | < 200ms | > 500ms | > 2s |
| API Response Time (p99) | < 500ms | > 1s | > 5s |
| Memory Usage | Stable | Growing 10%/hr | Growing 50%/hr |
| DB Query Time (p95) | < 50ms | > 100ms | > 500ms |
| Error Rate | < 0.1% | > 1% | > 5% |
| Throughput | Baseline | -20% | -50% |

## Runtime-Specific Optimizations

| Operation | Principle | Guidance |
|-----------|-----------|----------|
| File I/O | Use native async file API | Prefer runtime-provided async readers over polyfills |
| HTTP client | Use native fetch with streaming | Use streaming body readers for large responses |
| Child processes | Use native process spawning | Use runtime-specific spawn API for subprocesses |
| WebSocket | Use native WS support | Prefer built-in WebSocket server over libraries |
| Database | Use native drivers | Use runtime-optimized database bindings |

## Output Format

```markdown
## Performance Review: [Component]

### Critical Issues
- **N+1 Query**: `userService.ts:45`
  - Impact: 101 queries instead of 2 (50x slowdown)
  - Measured: 2.5s vs 50ms expected
  - Fix: Use JOIN or batch query

### High Impact
- **No Pagination**: `GET /api/posts` returns unbounded data
  - Impact: OOM at scale, timeout for large datasets
  - Fix: Add limit/offset with max 100

### Medium Impact
- **No Caching**: Expensive computation repeated
  - File: `analytics.ts:120`
  - Impact: 500ms repeated computation
  - Fix: Add LRU cache with 5min TTL

### Low Impact
- **Debug Logging**: Debug statements in production
  - Files: Multiple
  - Fix: Use proper logger with level control

### Metrics Summary
| Endpoint | p95 Latency | Status |
|----------|-------------|--------|
| GET /users | 150ms | OK |
| GET /posts | 2.5s | Critical |
| POST /order | 300ms | Warning |

### Passed Checks
- [x] Connection pooling configured
- [x] Compression enabled
- [x] No synchronous I/O
- [x] Indexes on foreign keys
```

## Reference Files

| Topic | File | Contents |
|-------|------|----------|
| N+1 and sequential-op patterns | `${CLAUDE_SKILL_DIR}/references/performance/n-plus-one-patterns.md` | Detailed N+1 query problem (Problem/Impact/Detection/BEFORE-slow/AFTER-fast with JOIN and batch-loading variants), plus synchronous blocking, unbatched operations, and sequential-await-in-loop anti-patterns. Read when a query-in-loop or sequential-await pattern is suspected. |
| Memory leak and serialization patterns | `${CLAUDE_SKILL_DIR}/references/performance/memory-leak-patterns.md` | Detection and fix patterns for unbounded cache growth, event listener leaks, closure-captured references, and large-object serialization CPU spikes. Read when memory grows over time, OOM crashes are reported, or GC pauses degrade p99 latency. |

## Gotchas

| Gotcha | Why | Workaround |
|--------|-----|------------|
| Optimizing before measuring leads to wrong bottleneck | Intuition about performance hotspots is often wrong | Always profile first with actual production-like data |
| N+1 false positive when ORM uses eager loading or batched queries | Code pattern looks like N+1 but ORM optimizes behind the scenes | Check generated SQL, not just code pattern |
| Connection pool != cache (pool manages connections, not query results) | Confusing the two leads to wrong architecture decisions | Don't confuse pooling with caching, they solve different problems |
| `async/await` in loops looks sequential but may be batched by runtime | Some runtimes optimize sequential awaits internally | Verify actual execution order with timing logs, not just code reading |
| Micro-benchmarks don't reflect production (JIT warmup, GC pressure differ) | Isolated benchmarks miss real-world contention and memory pressure | Use realistic workloads and sustained load tests |
