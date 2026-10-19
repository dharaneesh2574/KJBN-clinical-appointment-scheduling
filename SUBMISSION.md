# A. What I built

Problem 2 scaffold: React/Vite frontend and NestJS backend connected through
Prisma's PostgreSQL adapter. Environment configuration is validated and injected.
M1 models all required entities with migration constraints, a fictional seed,
and real-PostgreSQL tests. Local container verification is in progress; core
booking workflows are not yet implemented.

## B. Three design decisions

1. **PostgreSQL/Prisma.** Alternative: application-only persistence checks. Chosen
   for typed queries plus custom SQL constraints. Cost: migration and real-DB testing.
2. **Injected configuration.** Alternative: scattered `process.env` reads. Chosen
   to validate once and isolate infrastructure configuration. Cost: explicit test setup.
3. **Feature-owned domain types.** Alternative: sharing Prisma records everywhere.
   Chosen to keep business policies independent of transport/storage. Cost: mappings
   will be required at infrastructure boundaries.

## C. The hardest part

The first real-DB run exposed Prisma dynamic imports inside Jest; the integration
runner now uses VM-module support. Fresh-database tests also checked SQL null
semantics in the status-event constraint. Ten real-DB tests pass, including
concurrent overlap inserts. Full cap/availability transaction safety remains M2.
Earlier Prisma setup is `c5cc50f`; M0 configuration is `c9a3346`.

## D. How I handle failure

Configuration fails at startup with messages that omit supplied values. The future
HTTP layer must distinguish bad requests, business conflicts, persistence failures,
and unexpected exceptions; this envelope and structured logging are pending M3.

## E. Milestone log

| Milestone | Date completed | Actual commit hash |
| --- | --- | --- |
| M0 | 2026-10-19 | `c9a3346` |
| M1 | Verified 2026-10-19 | Hash recorded in next milestone commit |
| M2 | Not started | — |
| M3 | Not started | — |
| M4 | Not started | — |
| M5 | Container setup requested early; incomplete | — |
| M6 | Not started | — |

## F. If I had two more days

1. Finish protected booking transactions and rule boundaries: correctness first.
2. Add API validation and safe errors: clear contracts for the UI.
3. Implement real scheduling UI flows: complete the user's workflow.
4. Verify deployment and CI: repeatable operation and review.
5. Run hosted edge cases and finalize documentation: accurate submission evidence.

## G. Self-assessment

Provisional scores describe current partial implementation, not the final product.

| Rubric | Weight | Score (1–5) | Justification |
| --- | --- | --- | --- |
| Business logic correctness | 25 | 1 | Use cases pending |
| Code clarity and structure | 14 | 2 | Boundaries established; feature work pending |
| Error and exception handling | 10 | 1 | Configuration validated; HTTP handling pending |
| Logging and observability | 8 | 1 | Structured logging pending |
| Data modelling and persistence | 9 | 3 | Entities, constraints, migrations, repeatable seed tested |
| API design | 8 | 1 | Core endpoints pending |
| UI usability | 6 | 1 | Starter UI |
| Testing | 7 | 2 | 25 unit and 10 real-DB tests; M2 acceptance TODOs remain |
| Deployment and operability | 5 | 1 | Container verification in progress |
| Git hygiene | 4 | 2 | Incremental history; milestone tracking started |
| Documentation and write-up | 4 | 2 | Required structure present; final evidence pending |
