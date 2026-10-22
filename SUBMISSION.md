# A. What I built

Problem 2 is a two-doctor clinic scheduler using React/TypeScript, NestJS,
PostgreSQL and Prisma. It implements R1–R7, appointment booking/rescheduling,
patient history/flags, availability management and today's queue through the real
API. Local verification passes 220 backend and 27 browser tests, with 97.47%
overall backend line coverage and 97.91% business-code line coverage. Public
hosting and release verification remain incomplete; see [M6 evidence](docs/m6-verification.md).

## B. Three design decisions

1. **Decision:** serialize scheduling writes with one PostgreSQL transaction lock.
   **Alternative considered:** ordered resource row locks or serializable retries.
   **Why I chose this:** two doctors benefit from a single understandable boundary
   protecting overlaps, capacity, penalties, edits and atomic rescheduling. After
   waiting, READ COMMITTED sees the winning transaction; GiST constraints independently
   prevent overlapping occupied appointments. **What it cost me:** unrelated writes
   wait, limiting throughput. Bounded lock/transaction timeouts deliberately return
   conflicts. Directory/history reads instead use coherent RepeatableRead snapshots,
   keeping ordinary reads outside the scheduling write lock.
2. **Decision:** isolate pure policies behind feature-owned ports and inject one
   immutable request clock. **Alternative considered:** rules in controllers,
   direct Prisma orchestration everywhere, or mutable global reviewer time.
   **Why I chose this:** HTTP and non-HTTP callers share validation and business
   rules; concurrent reviewer requests remain independent, and rescheduling uses
   one time snapshot throughout. **What it cost me:** explicit mappings, provider
   bindings and transaction-aware adapters. I also replaced the original database
   wall-clock DOB constraint so valid reviewer dates cannot contradict application
   validation.
3. **Decision:** select API-returned slots, refresh after writes and preserve
   rejected inputs in the UI. **Alternative considered:** duplicating policies
   in React or demonstrating against mock appointments. **Why I chose this:**
   the backend remains authoritative during booking races, rollback and penalty
   expiry, while patient/doctor selection and visual time chips simplify booking.
   **What it cost me:** explicit response decoders, asynchronous states and isolated
   browser fixtures. Native dialogs needed focus restoration after unmount;
   mobile layouts needed shrinkable grid tracks to prevent overflow.

## C. The hardest part

Protecting atomic changes across PostgreSQL and UI races required evidence,
not just preflight checks. M2 (`ecdbbe0`) introduced protected transactions;
M3 (`f07683a`) verified actual HTTP failures and rollback. M4 (`9197ec5`)
addressed mobile layout and dialog focus; dashboard/calendar follow-ups landed
in `eff65d8`. That M5 implementation also exposed a seed failure after availability
windows acquired new IDs. A real-database regression reproduced it. Initializing
availability only for newly created seed doctors preserves edited hours, closed
days and overrides on re-seed. Both seed regressions and database outage/recovery
checks pass. `eff65d8` records implementation, not proof of public deployment.

## D. How I handle failure

Invalid input returns 400; missing resources 404; disabled reviewer time 403;
business, duplicate-phone and contention conflicts 409. Unexpected database or
application failures roll back and return safe 500 responses. Readiness returns
503 during database failure while liveness remains available. Errors carry a
request ID and one structured UTC completion log with route, status, duration,
code and non-sensitive IDs. Bodies, personal values, credentials and raw exception
text are excluded. The UI explains failures, preserves inputs, refreshes stale
slots and requires confirmation; it never retries a write automatically.

## E. Milestone log

| Milestone | Date completed | Actual commit hash |
| --- | --- | --- |
| M0 | 2026-10-19 | `c9a3346` |
| M1 | 2026-10-19 | `7e795de` |
| M2 | Verified 2026-10-20 | `ecdbbe0` |
| M3 | Verified 2026-10-20 | `f07683a` |
| M4 | Verified 2026-10-20 | `9197ec5`; follow-ups in `eff65d8` |
| M5 | Local gates 2026-10-20; packaging reverified 2026-10-22; public gate incomplete | `eff65d8`; packaging pending manual commit |
| M6 | Local docs verified 2026-10-20; release gate incomplete | Pending manual commit |

## F. If I had two more days

1. Resolve lockfile packaging so fresh clones and CI reproduce installation.
2. Deploy the seeded services and confirm review availability before database expiry.
3. Verify hosted boundaries and CI to establish release evidence.
4. Extend browser/accessibility checks to catch untested device regressions.
5. Repeat the final committed clone so the release tag identifies reproducible code.

## G. Self-assessment

Provisional scores reflect verified local behavior.

| Rubric | Weight | Score (1–5) | Justification |
| --- | --- | --- | --- |
| Business logic correctness | 25 | 4 | R1–R7 and real concurrency/rollback checks pass |
| Code clarity and structure | 14 | 4 | Thin controllers, feature ports and pure policies |
| Error and exception handling | 10 | 4 | Safe envelopes, deliberate conflicts and rollback |
| Logging and observability | 8 | 4 | Correlated sanitized logs; hosted evidence pending |
| Data modelling and persistence | 9 | 4 | Migrations, constraints and repeatable fictional seed |
| API design | 8 | 4 | Validated core routes, pagination and OpenAPI |
| UI usability | 6 | 4 | Real flows, IST, responsive and keyboard checks |
| Testing | 7 | 4 | 220 backend/27 browser; business lines 97.91% |
| Deployment and operability | 5 | 3 | Local recovery passes; public deployment pending |
| Git hygiene | 4 | 3 | Actual history retained; release packaging pending |
| Documentation and write-up | 4 | 4 | Required structure, disclosure and qualified evidence |
