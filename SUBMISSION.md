# A. What I built

Problem 2 currently has a React/Vite scaffold and a NestJS/Prisma/PostgreSQL backend.
M2 implements R1–R7 as testable policies and protected application use cases,
including atomic rescheduling, lifecycle/deposit rules, and schedule/doctor edits.
A realistic repeatable seed and local full-stack containers are verified.
HTTP scheduling endpoints, integrated UI and public deployment remain incomplete.

## B. Three design decisions

1. **Decision:** serialize scheduling writes with one PostgreSQL transaction lock.
   **Alternative considered:** ordered doctor/patient row locks or serializable
   retries. **Why I chose this:** a two-doctor clinic benefits from an auditable,
   consistent boundary for overlaps, caps, penalties, edits and cross-doctor
   rescheduling; READ COMMITTED reads after acquiring the lock see committed
   winners. Existing GiST constraints additionally protect occupied intervals.
   **What it cost me:** independent writes wait for one another and advisory slot
   reads briefly share that lock, limiting throughput. Bounded waits return an
   explicit retryable conflict instead of retrying invisibly.
2. **Decision:** keep policies/use cases independent of Prisma and HTTP through
   small transaction-aware ports and an injected clock. **Alternative considered:**
   implementing scheduling directly in controllers or a Prisma service.
   **Why I chose this:** pure policies explain each R1–R7 rule, one operation owns
   its transaction, and rescheduling can reuse booking checks without opening a
   second transaction or rereading time. **What it cost me:** explicit persistence
   mappings, Nest provider bindings and a memory double that must honor rollback,
   ordering, missing-resource and clock semantics. Real database tests are still
   necessary to prove concurrency protection.
3. **Decision:** preserve cancelled rows, slot-duration snapshots and append-only
   status events; derive deposit eligibility from history. **Alternative considered:**
   deleting cancellations, overwriting an appointment on reschedule, or maintaining
   a permanent deposit-required flag. **Why I chose this:** cancellation history
   remains explainable, failed rescheduling restores everything, and expired
   penalties cannot leave stale eligibility flags. **What it cost me:** additional
   events/relations and participation rules, plus conservative edit validation that
   protects historical occupied rows. Future date overrides are needed when weekly
   edits would invalidate immutable history; acknowledgement does not process money.

## C. The hardest part

The challenge was protecting caps and availability edits as well as overlaps. A
preflight query cannot prevent concurrent requests from sharing the last place.
M2 now checks and writes under one transaction lock; real-DB races verify the
loser gets a deliberate conflict. A forced failure after replacement insertion
proves atomic rollback of cancellation, replacement and events. The lock-timeout
test exposed Prisma 7's nested PostgreSQL SQLSTATE metadata; correcting the mapper
made the busy response deliberate too. M1's schema is committed as `7e795de`;
M0 configuration is `c9a3346`. M2 is verified 2026-10-20 and awaits a manual commit,
so its hash is not yet available.

## D. How I handle failure

Domain validation raises `INVALID_DOMAIN_VALUE`; rule failures carry stable codes
such as `DOCTOR_OVERLAP`, `DAILY_CAP_REACHED`, `DEPOSIT_REQUIRED` and
`SCHEDULE_CONFLICT`, whose details identify affected appointments. Missing resources
raise `NOT_FOUND`. Transaction lock timeouts become `CONCURRENT_MODIFICATION`.
Unexpected database/application errors propagate and roll back every write; the
adapter does not turn every failure into a business conflict. M3 must map these to
safe HTTP status/envelopes and log unexpected failures once with request context.
Structured request logging, final API validation and error envelopes are not yet
implemented; the current HTTP surface remains the scaffold smoke route.

## E. Milestone log

| Milestone | Date completed | Actual commit hash |
| --- | --- | --- |
| M0 | 2026-10-19 | `c9a3346` |
| M1 | 2026-10-19 | `7e795de` |
| M2 | Verified 2026-10-20 | Pending user manual commit |
| M3 | Not started | — |
| M4 | Not started | — |
| M5 | Local container subset verified 2026-10-19; milestone incomplete | Pending full deployment gate |
| M6 | Not started | — |

## F. If I had two more days

1. Add validated scheduling endpoints, clock scope and OpenAPI for a usable API.
2. Implement safe HTTP errors, structured logs and API tests for failure behavior.
3. Build scheduling/queue/history UI against the API for complete clinic workflows.
4. Add CI, readiness and hosting for repeatable deployment and reviewer access.
5. Run clean-clone and hosted edge cases, then finalize submission evidence.

## G. Self-assessment

Provisional scores describe the current partial product.

| Rubric | Weight | Score (1–5) | Justification |
| --- | --- | --- | --- |
| Business logic correctness | 25 | 4 | R1–R7 pass with real transaction/race evidence; HTTP integration pending |
| Code clarity and structure | 14 | 4 | Policies, focused use cases, small ports and explicit adapters |
| Error and exception handling | 10 | 2 | Stable domain codes and rollback; HTTP envelope pending |
| Logging and observability | 8 | 1 | Structured logging pending |
| Data modelling and persistence | 9 | 4 | Constraints, migrations, repeatable seed and protected writes verified |
| API design | 8 | 1 | Core endpoints pending |
| UI usability | 6 | 1 | Starter UI |
| Testing | 7 | 4 | 99 unit/acceptance + 1 HTTP smoke + 30 real-DB tests; business lines 96.76% |
| Deployment and operability | 5 | 2 | Healthy local stack; hosting/readiness/CI pending |
| Git hygiene | 4 | 3 | Incremental milestone history; M2 awaits manual commit |
| Documentation and write-up | 4 | 3 | Current rules, tradeoffs, coverage and prompt evidence; final checks pending |
