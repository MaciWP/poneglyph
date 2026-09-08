---
us: US1
title: Verified lifecycle transitions
wave: W1
depends_on: []
tdd: forced
status: closed
approved: 2026-09-08
closed: 2026-09-08
---

# Execution prompt

Implement AC1–AC4 in the existing flow-state helper and a small shared contract. Reuse the shared YAML parser. Add negative tests before implementation. Preserve CLI status and historical readers. Return observed checks and keep state authoritative over document projections.

Verification: flow-state and flow-contract tests, including real CLI and recovery cases.
