# M2 business rules — verified 2026-10-20

M0/M1 prerequisites were checked against the committed entities, schema, migration,
seed, and their passing tests. M2 was implemented and verified before the user's
manual commit `ecdbbe0`. Original verification figures below are retained; root
`coverage.txt` now tracks the latest milestone. No Git staging/push was performed
by the assistant.
This is the historical M2 exit record. M3 HTTP work is now verified separately in
[M3 evidence](m3-verification.md); the scheduling UI remains M4.

## Implemented behavior

| Rule | Policy / use case | Evidence |
| --- | --- | --- |
| R1 | `effective-availability.ts`, `EditSchedule`, `UpdateDoctor` | Exact window edges, 15/30-minute slots, off-grid milliseconds, complete override replacement, leave/extra day, invalid edits, override removal, concurrent booking/edit |
| R2 | `booking-policy.ts`, `BookAppointment`, committed doctor GiST constraint | Partial/containing overlaps, adjacency, cancellation reuse, real concurrent application bookings |
| R3 | `booking-policy.ts`, patient GiST constraint | Cross-doctor overlap, adjacency, simultaneous bookings, reschedule vs patient booking |
| R4 | `assertCapacity`, protected doctor edits | Cap boundaries, all participating statuses, IST midnight, cancellation release, final-capacity races and cap-edit races |
| R5 | `lifecycle-policy.ts`, `CancelAppointment`, `FinishAppointment` | 119/120/121-minute boundaries, penalty counts 1/2/3, mixed events, `(now-30d, now]`, expiry, deposit acknowledgement, idempotency and status races |
| R6 | `RescheduleAppointment` | Linked cross-doctor replacement, validation rollback preserving original row/history/updatedAt, failure after replacement insertion, concurrent reschedules, retained late penalty |
| R7 | `assertHorizon`, `Clock`, `snapshotClock`, clinic-time helpers | Past/exact-now, inclusive 60 elapsed days, millisecond beyond boundary, IST/UTC/month/year/leap boundaries, one snapshot and isolated review overrides |

Unit/acceptance tests: `backend/test/rules.acceptance.spec.ts` and existing
`backend/src/**/*.spec.ts`. Real-database tests:
`backend/test/scheduling.integration-spec.ts` and `domain.integration-spec.ts`.
The old 35 TODOs have been replaced with 74 executable acceptance cases; none remain
TODO. Real-database concurrency evidence comes from the application use cases,
not just direct inserts or mocked Prisma calls.

## Transaction strategy and limits

`PrismaSchedulingUnitOfWork` opens a READ COMMITTED interactive transaction, sets a
5-second PostgreSQL lock timeout, and acquires
`pg_advisory_xact_lock(1263157838, 2)` before any scheduling read. All booking,
cancellation, completion/no-show, rescheduling, weekly/date-override edits, and
doctor-setting writes use this boundary. The lock belongs to the transaction and
is shared across connections/processes; commit/rollback releases it automatically.
There is one lock and therefore no resource lock-order cycle, even for reschedules
across two doctors. READ COMMITTED is deliberate: after waiting for another writer,
the next statement sees that writer's committed result.

One clinic-wide lock serializes writes. This is conservative and suitable for a
small two-doctor clinic, with lower throughput than a carefully ordered doctor/
patient lock scheme. Free-slot reads also use the boundary for a coherent snapshot;
they do not mutate domain data and their results are advisory. Recheck at booking.
Transactions have a 5-second pool acquisition bound and 15-second execution bound.
Known lock timeout/transaction contention errors become `CONCURRENT_MODIFICATION`;
there is no hidden retry. Unexpected failures retain their identity for M3's safe
HTTP/logging boundary. Integration testing caught Prisma 7's nested adapter
SQLSTATE metadata; the busy-response test now verifies the actual timeout path.

The existing committed GiST exclusion constraints independently protect doctor and
patient occupied intervals. They do not enforce caps, availability or penalties.
All application writers must use the unit of work; direct SQL is an administrative
bypass and cannot be claimed safe for those rules. No new migration was necessary.

The explicit fictional seed shares the same lock and checks the resulting doctor
schedules/caps before commit. Historical import intentionally bypasses new-booking
horizon/lifecycle checks. Re-seeding preserves edits or rolls the entire import back
on conflict; it never silently overwrites user changes.

Rescheduling writes cancellation + its event, then books + creates its initial
event inside the same transaction. A newly incurred late penalty participates in
deposit eligibility. Any failure restores all rows/events and capacity, including
a deliberately injected failure after the replacement was inserted.

## Boundaries and SOLID

- Pure policies and consumer-owned ports have no NestJS, HTTP, Prisma or env imports.
- Appointment use cases orchestrate operations; `EditSchedule` owns availability
  edits, and the doctors feature owns `UpdateDoctor`. Controllers are unchanged.
- Small `BookingStore`/`ScheduleStore` ports share the actual transaction; the Prisma
  adapter maps explicit domain fields and owns all queries/status-event writes.
- Nest modules bind the unit-of-work and clock contracts to infrastructure and
  export use cases. The memory double serializes, commits/rolls back, reports
  missing resources and orders results consistently with its documented contract.
- The system clock is injected; every time-dependent operation reads it once,
  before entering the transaction. Rescheduling reuses that value throughout.
  `FixedClock` freezes a validated string snapshot. `snapshotClock` restricts
  overrides to a trusted review-mode argument; M3 must bind that to configuration
  and create the snapshot per HTTP request. No header or clock endpoint exists yet.

## Verified commands and results

Run from `backend/` unless otherwise noted:

| Check | Result |
| --- | --- |
| `npm run build` | Pass, including Prisma client generation |
| `npx tsc --noEmit --incremental false` | Pass, including test/seed types |
| `npx eslint src test prisma.config.ts prisma/seed.ts` | Pass; no warnings, fixes or suppressed errors |
| `npm run prisma:validate` | Pass |
| `npm test -- --runInBand` | 99 passed: 74 acceptance + 25 existing unit tests |
| `npm run test:rules` | 74 passed; no TODOs/skips |
| `npm run test:cov -- --runInBand` | Pass, including enforced business-module thresholds |
| Root: `docker compose --env-file .env.example --profile test run --build --rm integration npm run test:all` | 99 unit/acceptance + 1 HTTP smoke + 30 real PostgreSQL tests passed |

The Docker test database is isolated (`kjbn_test_m1`, PostgreSQL 17 on tmpfs) and
never uses the application database volume. The migration is deployed by each
integration suite; the first run used the newly started disposable database. The
seed repeatability suite runs twice against this isolated database only. Docker
access and the native smoke test's loopback listener required sandbox elevation;
no product behavior was changed to bypass those environment restrictions.

Coverage is a unit/acceptance measurement, with integration and HTTP evidence
reported separately: **96.76% business-code lines** (329/340), **73.16% overall
backend lines** (379/518; Jest truncates percentages). Business scope includes all
handwritten feature `domain/` and `application/` files plus `common/domain/` (19
files). Only generated Prisma code is excluded from overall source coverage;
bootstrap, Nest wiring and DB adapters remain in its denominator. DB adapters are
exercised by the separate real-PostgreSQL suite, whose coverage is not merged.
See root `coverage.txt` for all four metrics. ESLint now rejects explicit `any`,
floating promises and unsafe arguments rather than allowing/warning on them.

## Remaining gates at the M2 boundary (historical)

M3: real endpoints, DTOs, safe error envelope, structured request logging,
configuration-bound request clock, OpenAPI and API workflows. M4: real API UI.
Hosted/clean-clone/final-submission verification remains later milestone work.
Schedule edits conservatively protect historical occupied rows too; use future
date overrides when changing weekly hours would invalidate immutable history.
