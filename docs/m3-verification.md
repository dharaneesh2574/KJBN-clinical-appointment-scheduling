# M3 API — verified 2026-10-20

M2's policies, transaction gate and preceding tests were verified before exposing
HTTP. Its implementation is committed as `ecdbbe0` (the user's actual manual
commit; no history was rewritten). M3 is verified and pending the user's manual
commit. No Git staging, commit, or push was performed by the assistant.

## API surface and boundaries

The API now supports doctor creation/list/get/settings replacement; weekly and date
availability management; free slots; patient creation/get/update/normalized phone
lookup; paged patient history with status events and explained deposit eligibility;
booking/rescheduling/cancellation/final status; and filtered IST appointment-day
lists for grids and today's queue. See README section 7 or `/docs-json` for routes.

Controllers parse validated DTOs, invoke application use cases, and map explicit
response classes. They do not query Prisma or implement scheduling/transaction
rules. New directories and read ports belong to their feature domains. Existing
M2 write use cases still own scheduling invariants and atomic history. Doctor and
patient directory writes share the same advisory lock; read queries use coherent
READ COMMITTED locked scheduling snapshots or read-only RepeatableRead snapshots.
Collection responses are bounded and stably ordered; history penalty calculation
is independent of the returned page. No patient/appointment deletion endpoint can
erase audit history. Full doctor replacement uses PUT; deactivation is the existing
protected setting change, rather than destructive deletion.

DTOs use class-validator/class-transformer through one production/test setup:
`transform=true`, `whitelist=true`, `forbidNonWhitelisted=true`,
`forbidUnknownValues=true`, and no implicit conversion. Only explicit query integer
and boolean transforms coerce URL strings; body booleans/numbers must have the right
JSON types. Nested windows reject extra properties. Date/instant decorators reuse
the pure domain validators, including real calendar dates and mandatory timestamp
offsets. Application/domain validation also holds outside HTTP.

Pagination defaults to offset 0 / limit 20; limit is 1–100 and offset 0–1,000,000.
Availability reads default to the current IST date through 60 days later, allow an
inclusive date range with at most 366 elapsed days between endpoints, and limit
submitted day windows to 32. These operational limits are project assumptions,
not extra assignment requirements.

## Error behavior and logging

Responses use `{ code, message, details?, requestId }`:

| Failure | HTTP | Examples |
| --- | --- | --- |
| Invalid DTO/unknown property | 400 | `VALIDATION_FAILED` |
| Invalid application/domain value | 400 | `INVALID_DOMAIN_VALUE` |
| Missing addressed resource | 404 | `NOT_FOUND` |
| Disabled reviewer override | 403 | `CLOCK_OVERRIDE_DISABLED` |
| Scheduling/uniqueness conflict | 409 | `DOCTOR_OVERLAP`, `DAILY_CAP_REACHED`, `PHONE_ALREADY_EXISTS`, `SCHEDULE_CONFLICT` |
| Bounded transaction contention | 409 | `CONCURRENT_MODIFICATION` |
| Unexpected/database failure | 500 | `INTERNAL_ERROR`, safe fixed message |

Schedule conflicts expose affected appointment IDs. Validation errors do not echo
submitted values. Raw database metadata, exception messages/stacks, request bodies,
patient names/phones/DOBs, and connection strings are never included in request logs
or unexpected-error responses. Known Prisma transaction errors retain M2's deliberate
busy mapping. An actual duplicate-phone API test exposed Prisma 7's nested constraint
metadata; only the Patient `patients_phone_key` constraint (or the equivalent legacy
phone target) is translated to `PHONE_ALREADY_EXISTS`. Unrecognized failures are
not silently turned into conflicts.

One server-generated UUID is returned as `X-Request-Id` and in error responses.
Each completed HTTP request emits one JSON record to stdout: real UTC timestamp,
info/warn/error level, request ID, route-template operation, status, elapsed time,
optional safe error code, and validated UUID resource IDs. Query strings/raw URLs
are excluded, including phone lookups and unmatched paths. Rule/input failures use
warn and unexpected failures use error. The filter records safe failure context;
it does not emit a second error log. Startup emits sanitized structured READY or
STARTUP_FAILED records. Responses carry `Cache-Control: no-store`. CORS exposes the
request-ID header and permits the reviewer header only for configured origins.

## One immutable request clock

Middleware captures arrival time once through the injected SystemClock. A
request-scoped Clock provider and a global guard resolve one frozen FixedClock for
that request. Guards and all use cases share it; parallel overrides cannot affect
one another or subsequent requests. `X-Review-Now` requires `REVIEW_MODE=true` and a
real timestamp with explicit timezone; disabled mode returns 403 and malformed
values return 400. Request logs always use actual UTC time, not reviewer time.
The global/system clock is never changed.

The initial database DOB check used PostgreSQL CURRENT_TIMESTAMP, which contradicts
a valid reviewer request set to a different date. The new SQL migration
`20261020120000_request_clock_dob_validation` removes that clock-dependent check and
keeps structural date bounds. The patient application use cases enforce non-future
DOB against the same request snapshot, even during future-date review. Direct
administrative SQL bypasses this application policy; it is not an API path. No old
migration was edited and no db-push/dashboard DDL was used.

## OpenAPI and verification

Swagger UI: `/docs`; machine-readable OpenAPI 3 document: `/docs-json`. Request and
response classes, enums, nested windows, pagination, errors, and reviewer header
are described. The existing scaffold `/` remains a compatibility/liveness smoke
route; it is not a database-readiness endpoint. UI integration remains M4.

Verified commands from `backend/`:

- `npm run build`: pass, including Prisma generation.
- `npx tsc --noEmit --incremental false`: pass, including test/seed types.
- `npx eslint src test prisma.config.ts prisma/seed.ts`: pass, no warnings/fixes.
- `npm run prisma:validate`: pass.
- `npm test -- --runInBand`: 113 pass (74 R1–R7 acceptance, 14 M3 application,
  25 existing tests).
- `npm run test:e2e -- --runInBand`: existing configured HTTP smoke passes.
- `npm run test:all`: 113 unit/acceptance + 1 smoke + 100 real-DB tests pass;
  70 of those real-DB tests exercise the actual API pipeline, 30 retain M1/M2
  migration/transaction evidence. Docker was used for the full isolated gate.
- `npm run test:cov:all`: 214 tests pass with combined coverage thresholds.
  Requires isolated `TEST_DATABASE_URL`; see README for the one-command Docker form.

Combined coverage (only generated Prisma code excluded; bootstrap and wiring kept):
**97.48% overall backend lines**, **84.83% overall branches**; business domain/
application/shared-domain code is **97.91% lines** (422/431; 28 files), **95.34%
branches**. Unit-only coverage remains separately available through `test:cov`:
39.34% overall lines and 97.21% business lines; it does not instrument HTTP/DB suites.
See root `coverage.txt` for counts and all four metrics. The combined gate enforces
80% global metrics and the existing specific business-module thresholds; global
thresholds apply to the remainder after explicitly scoped Jest thresholds.

API evidence includes all core workflows, nested DTO/type/date/unknown-field
failures, missing resources, duplicate phones, safe malformed-JSON/500 responses,
parallel request-clock isolation, immutable time use, correlation/redaction,
OpenAPI schema/routes, real HTTP booking/cap races, failed atomic rescheduling,
penalty acknowledgement/expiry, and protected edits. Tests use a disposable
`kjbn_test_*` database and fictional data; none call a public hosted service.

Official references consulted: [Nest validation](https://docs.nestjs.com/application/validation),
[Nest request scopes](https://docs.nestjs.com/fundamentals/injection-scopes), and
[Nest OpenAPI](https://docs.nestjs.com/openapi/introduction). Swagger 11 was selected
to match the existing NestJS 11 manifest; no forced peer resolution or framework
upgrade was used.

## Running-container check

The rebuilt local backend applied the new migration and served `/docs`,
`/docs-json` (16 resource paths), and `/doctors?limit=1` with HTTP 200, a generated
request ID and `Cache-Control: no-store`. Normal review-disabled configuration
rejected `X-Review-Now` with 403. The configured localhost:8080 CORS preflight
returned 204, and the existing frontend `/api/docs-json` proxy returned 200.
Actual container output contained correlated JSON route-template records with
warn/code for the disabled override. These were read-only checks; no clinic data
was created or re-seeded. Database readiness and UI workflows remain later gates.
