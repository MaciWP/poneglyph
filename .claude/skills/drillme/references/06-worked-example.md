---
parent: drillme
name: worked-example
description: A 22-question battery over five funnel rounds on an ambiguous caching decision — capability, not a quota.
---

# Worked example (battery on an ambiguous decision)

Relocated verbatim from `SKILL.md` on 2026-09-03 (plan 032/WP4).

Context: *"I want to add caching to the products endpoint."* The gap gate returns **Yes** (many unstated decisions). A first sweep produces a battery like this (delivered across ~5 funnel rounds, not at once) — illustrating that 20-40 questions is normal when the gaps are real. This is capability, **not a quota**:

```
ROUND 1 — open / framing
1.  [approach]  What problem does caching solve here — latency, DB load, cost? Which is the binding one?
2.  [approach]  Why caching over the alternatives (read replica, query optimization, denormalization)? What was rejected?
3.  [failure]   What happens today without it — is this a real, measured pain or anticipated?

ROUND 2 — context / surface
4.  [context]   What reads the products endpoint, and how fresh must the data be per consumer?
5.  [context]   Is product data written from one place or many? Who invalidates?
6.  [location]  Cache at which layer — HTTP/CDN, application, or DB query cache?
7.  [context]   Does any existing caching exist in the project we should extend, not reinvent?

ROUND 3 — invalidation & correctness (lateral)
8.  [failure]   On a product update, how stale can a read be? Seconds? Minutes? Never?
9.  [failure]   What's the invalidation trigger — write-through, TTL, event, manual purge?
10. [failure]   What happens on a cache miss storm (cold start, mass invalidation)? Thundering herd?
11. [failure]   Silent failure: if the cache returns stale/wrong data, how would we even notice?

ROUND 4 — operational / lateral aspects
12. [context]   Where does the cache live — in-process, Redis, CDN? Who operates it?
13. [failure]   What's the behaviour if the cache backend is down — fail open (DB) or fail closed?
14. [context]   Memory/size budget? Eviction policy? What's the key space cardinality?
15. [failure]   Per-tenant isolation: can tenant A's cached product leak to tenant B? (authz surface)
16. [context]   Observability: do we need hit/miss metrics, and where do they go?
17. [approach]  Migration/rollback: can we ship it dark/behind a flag and turn it off instantly?

ROUND 5 — scope / closing
18. [approach]  Simplest version that helps — just a 30s TTL on the list endpoint? Or full per-entity cache?
19. [approach]  What's explicitly OUT of scope for this change?
20. [context]   Cost/effort: is the latency win worth the operational surface a cache adds?
21. [failure]   6 months later this caused an incident — what was the most likely cause?
22. [approach]  Success metric: how do we know in 2 weeks this was the right call?
```

Each answer is baked into the spec/decision. The sweep stops when these are closed and no new gap surfaces — or soft-stops with `[OPEN]` if answers degrade. On a trivial input (`"rename count to total in this file"`) the same gate yields **zero** of these questions.
