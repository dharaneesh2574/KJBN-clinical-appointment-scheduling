# A. What I built

Problem 2 now has a NestJS/Prisma/PostgreSQL JSON API enforcing R1–R7, with a
React/Vite UI scaffold. Core endpoints support doctor/availability/patient
management, free slots, appointment lifecycle/rescheduling, phone lookup/history
and today's queue. M3 adds strict DTOs, safe correlated errors, structured logs,
request-isolated review time and executable OpenAPI documentation. Local containers
and 214 tests are verified; integrated UI and public hosting remain incomplete.

## B. Three design decisions

1. **Decision:** serialize scheduling and directory writes with one PostgreSQL
   transaction lock. **Alternative considered:** ordered doctor/patient row locks
   or serializable retries. **Why I chose this:** a two-doctor clinic benefits from
   a clear boundary for overlaps, caps, penalties, edits and rescheduling; after
   waiting, READ COMMITTED sees the winner's committed data. GiST constraints add
   overlap protection independently. **What it cost me:** unrelated writes wait
   and scheduling snapshots share the lock, limiting throughput. Pool/lock/transaction
   bounds return a deliberate conflict. Read-only directory/history pages use
   RepeatableRead for coherent items/counts instead of taking the write lock.
2. **Decision:** keep policies/use cases behind feature-owned ports and inject one
   frozen request clock. **Alternative considered:** scheduling in controllers,
   scattered Prisma access, or mutable global reviewer time. **Why I chose this:**
   the same M2 use cases now serve HTTP without duplicating rules; concurrent
   requests keep independent time and rescheduling reuses one snapshot throughout.
   **What it cost me:** explicit mappings, provider bindings and a shared request
   setup used by production and tests. M1's DB wall-clock DOB check needed a
   migration so it could not contradict a valid review snapshot.
3. **Decision:** publish explicit response DTOs, safe errors and one sanitized log
   per request while preserving appointment history. **Alternative considered:**
   returning Prisma rows, logging whole errors/bodies, or storing a permanent
   deposit flag. **Why I chose this:** clients get stable contracts, operators can
   correlate failures without names/phones/DOBs, and eligibility expires from its
   history window. **What it cost me:** response/schema classes and deliberate
   constraint mapping; an API test exposed Prisma 7's nested unique-constraint
   metadata. Unknown failures remain 500 and roll back rather than masquerading
   as successful operations or generic business conflicts.

## C. The hardest part

M3 had to expose M2 without weakening concurrency or letting request clocks leak.
The API and tests now share the same middleware, DTO pipe, filter, guard and
request-scoped Clock binding. Parallel overrides, real HTTP booking/cap races and
failed rescheduling pass. An actual duplicate-phone request initially returned a
safe 500 because Prisma 7 nests constraint information; mapping only the known
Patient phone constraint corrected it to 409. The M1 database DOB check also used
wall-clock time, so a new migration replaces it with structural bounds while
application validation uses request time. M2 is committed as `ecdbbe0`; M1 schema
is `7e795de`. M3 is verified 2026-10-20 and awaits a manual commit; its hash does
not exist yet.

## D. How I handle failure

Bad DTOs/unknown fields return 400 `VALIDATION_FAILED`; domain values return 400
`INVALID_DOMAIN_VALUE`; addressed missing resources return 404. Rule, phone and
bounded-contention conflicts return 409, with affected appointment IDs when useful.
A disabled reviewer header returns 403. Unexpected/database failures return 500
`INTERNAL_ERROR` with a fixed safe message and retain rollback. Every error includes
the server-generated request ID, also returned in `X-Request-Id`. One JSON completion
log contains UTC time, level, operation template, status, duration, safe code and
validated UUIDs. Expected failures use warn and unexpected failures error; bodies,
query strings, personal values, database URLs and raw exception text are excluded.

## E. Milestone log

| Milestone | Date completed | Actual commit hash |
| --- | --- | --- |
| M0 | 2026-10-19 | `c9a3346` |
| M1 | 2026-10-19 | `7e795de` |
| M2 | Verified 2026-10-20 | `ecdbbe0` |
| M3 | Verified 2026-10-20 | Pending user manual commit |
| M4 | Not started | — |
| M5 | Local container subset verified 2026-10-19; milestone incomplete | Pending full deployment gate |
| M6 | Not started | — |

## F. If I had two more days

1. Build day-grid, booking and rescheduling UI against the real API.
2. Add phone/history/flags and today's queue flows with responsive error states.
3. Add CI and database readiness for repeatable operation and failure detection.
4. Deploy/re-seed a public review environment and verify CORS/cold starts.
5. Run clean-clone and hosted edge cases, then finalize submission evidence/tagging.

## G. Self-assessment

Provisional scores describe the current partial product.

| Rubric | Weight | Score (1–5) | Justification |
| --- | --- | --- | --- |
| Business logic correctness | 25 | 4 | R1–R7 pass through policies and actual HTTP/DB workflows |
| Code clarity and structure | 14 | 4 | Feature-owned use cases/ports, thin controllers, explicit adapters |
| Error and exception handling | 10 | 4 | Consistent safe errors, deliberate conflicts, rollback and failure tests |
| Logging and observability | 8 | 4 | Correlated sanitized JSON logs; hosted operational visibility pending |
| Data modelling and persistence | 9 | 4 | Versioned constraints/migrations, repeatable seed, protected writes |
| API design | 8 | 4 | Core routes, strict nested DTOs, explicit responses, bounds and OpenAPI |
| UI usability | 6 | 1 | Starter UI; integration pending |
| Testing | 7 | 4 | 214 tests; combined lines 97.48% overall and 97.91% business |
| Deployment and operability | 5 | 2 | Local containers verified; hosting/readiness/CI pending |
| Git hygiene | 4 | 3 | Actual incremental history retained; M3 awaits manual commit |
| Documentation and write-up | 4 | 3 | Current routes/time/logging/tests documented; final hosted checks pending |
