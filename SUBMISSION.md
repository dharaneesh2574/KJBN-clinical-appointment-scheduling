# A. What I built

Problem 2 has a React/TypeScript clinic workspace backed by the NestJS/Prisma/
PostgreSQL API enforcing R1–R7. It supports doctor day grids, valid-slot booking/
rescheduling, patient registration/phone lookup/history/flags, today's queue and
clinic availability/settings. Strict API validation, safe errors/logging,
request-isolated reviewer time and OpenAPI are implemented. Local containers,
18 browser cases and 214 backend tests pass; public hosting and final operational/
submission gates remain incomplete.

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
3. **Decision:** let the UI select API-returned slots and eligibility, preserve
   rejected-write inputs, and refresh snapshots after changes. **Alternative
   considered:** calculating scheduling rules in React or using mock data for a
   visually complete demo. **Why I chose this:** one backend authority preserves
   concurrent booking, reschedule rollback and expiring penalty behavior; the
   frontend communicates its decisions clearly. **What it cost me:** explicit
   response decoding, loading/error states and isolated real-API browser fixtures.
   Native dialogs needed explicit focus restoration after React unmount, and the
   mobile grid needed shrinkable tracks to avoid page overflow.

## C. The hardest part

M2's concurrency boundary (`ecdbbe0`) and M3's real API (`f07683a`) had to remain
intact while building usable asynchronous UI flows. Browser tests create actual
PostgreSQL fixtures, race a booking against a stale slot, and verify a rejected
reschedule leaves the original Booked before a valid linked replacement succeeds.
A mobile test found navigation min-content sizing made the page 413px wide at a
375px viewport; shrinkable grid tracks fixed it. Another found that unmounting a
native dialog lost keyboard focus; capturing/restoring the connected opener fixed
that. Earlier hidden-history counts, worker fixture collisions and label selectors
were harness issues, corrected before the complete 18-case run passed. M4 is
verified 2026-10-20 and pending a manual commit; no hash is invented.

## D. How I handle failure

Invalid input returns 400, addressed missing resources 404, disabled reviewer
headers 403, and rule/phone/contention conflicts 409. Unexpected failures return
500 with a safe fixed message and rollback. Every error carries a generated
request ID; one structured completion log uses UTC, level, route template, status,
duration, safe code and UUIDs, excluding personal values and raw exception text.
The UI explains known codes, exposes correlation/affected references, preserves
recoverable form values, refreshes stale slots and requires a valid new choice.
Network/timeout errors advise checking the latest schedule before retrying; writes
are never retried automatically. Loading/empty/error states remain explicit.

## E. Milestone log

| Milestone | Date completed | Actual commit hash |
| --- | --- | --- |
| M0 | 2026-10-19 | `c9a3346` |
| M1 | 2026-10-19 | `7e795de` |
| M2 | Verified 2026-10-20 | `ecdbbe0` |
| M3 | Verified 2026-10-20 | `f07683a` |
| M4 | Verified 2026-10-20 | Pending user manual commit |
| M5 | Local container subset verified 2026-10-19; milestone incomplete | Pending full deployment gate |
| M6 | Not started | — |

## F. If I had two more days

1. Reconcile the staged lockfile removals with install/build commands for clean clones.
2. Add CI and database readiness to detect failures consistently.
3. Deploy/re-seed public UI/API and verify CORS, cold starts and reviewer access.
4. Expand browser/accessibility checks beyond the verified Chrome/phone-width flows.
5. Run clean-clone/hosted edge cases and finalize documentation, links and tagging.

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
| UI usability | 6 | 4 | Real API flows, explicit IST/flags/failures, responsive and keyboard checks |
| Testing | 7 | 4 | 18 browser + 214 backend cases; backend lines 97.48% overall / 97.91% business |
| Deployment and operability | 5 | 2 | Local containers verified; hosting/readiness/CI pending |
| Git hygiene | 4 | 3 | M0–M3 hashes recorded; M4 awaits manual commit; user staging preserved |
| Documentation and write-up | 4 | 3 | Current routes/time/logging/tests documented; final hosted checks pending |
