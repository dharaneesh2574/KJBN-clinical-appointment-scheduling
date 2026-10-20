# M5 — deployment and operability evidence

Date: 2026-10-20. M0–M4 gates preceded this work. Existing dashboard/calendar
changes remain preserved and uncommitted. No Git stage, commit or push was made.

## Implemented

- Existing non-root service Dockerfiles and persistent local Compose stack
  retained; tooling now includes lint/format configuration and a writable coverage
  directory. Backend runtime contains production dependencies only.
- `npm run dev` / `npm run dev:seed`: one-command local build, migration, readiness
  wait and optional explicit additive seed; absent default `.env` is initialized
  from the sanitized local example without overwriting existing configuration.
- `/health/live` and `/health/ready` documented in OpenAPI. Readiness checks a
  migrated table with bounded acquisition/connection/query/transaction times;
  database failure yields the correlated, sanitized 503 envelope.
- `npm test` / `npm run coverage`: one root gate for frontend build/lint, backend
  build/lint, unit/API/PostgreSQL/concurrency suites, operational failure/recovery
  and the existing real-API browser suite. Test projects are explicitly isolated.
- Read-only GitHub Actions workflow uses Node 24 and the same coverage gate.
- Proposed free Render Blueprint, strict public-origin inputs, private DB access,
  migration-first hosted launcher and explicit fictional seed configuration.
  See [deployment runbook](deployment.md) for account setup, expiry, redeploy,
  re-seed and failure recovery.

## Verification

| Gate | Evidence |
| --- | --- |
| Strict backend build and read-only lint | Passed after correcting a test matcher unsafe assignment |
| Backend combined coverage | 220/220 tests; 10 suites pass; real PostgreSQL included |
| Readiness failure and recovery | Isolated hosted startup/restart; liveness 200 throughout, readiness 200 → 503 → 200 when DB stops/restores |
| Hosted migration and seed sequence | Fresh isolated DB initialized by the actual hosted launcher; repeated startup succeeds |
| Full root gate/browser suite | `npm run coverage` exits 0; all 220 backend and 27 browser cases pass (51.7s browser run) |
| Normal local `dev:seed` command | Exits 0; database/API/UI healthy; explicit seed succeeds with existing edits; availability snapshots identical before/after |
| Local CORS/proxy/OpenAPI | Allowed UI origin granted, unknown origin not granted; frontend `/api` returns real seeded doctors/readiness; docs include health routes |
| Render Blueprint schema | Passed current official Draft 2020-12 schema; no account/resource validation implied |
| CI YAML | Parses; remote GitHub Actions run pending manual commit/push |
| Public UI/API, CORS and cold starts | Not deployed or measured |

The full gate initially caught missing lint/formatter configuration in the
tooling image and a non-root coverage-directory permission. Both were corrected.
The backend suite passed even when Jest could not write coverage; the root gate's
required copy correctly failed instead of accepting a missing report. A subsequent
browser attempt found no Playwright-downloaded Chromium; final local verification
uses the existing Chrome executable. CI explicitly installs Chromium and its OS
dependencies. No production DB was stopped or reset during failure testing.

The original normal-stack `dev:seed` run then exposed an existing seed defect:
replacing weekly hours gives windows new IDs, and re-seeding tried to recreate
the old windows. A 3.8-second real-DB regression failed before the fix and passed
afterward. Availability now bootstraps only for newly created seed doctors;
replacement hours, closed weekdays, leave windows and deleted overrides are
preserved. Two regressions join the full gate. The original `npm run dev:seed`
now exits 0; read-only snapshots confirm all existing availability rows are
identical before/after re-seeding. No temporary diagnostic code was added to the
application, and no existing clinic data was reset.

## Coverage scope

Combined backend: 97.47% lines, 96.93% statements, 84.83% branches and 98.50%
functions. Business-code lines remain 97.91%. The measured scope is `backend/src/**/*.ts`; tests, Prisma seed/config and
orchestration scripts are outside that runtime-source denominator. Seed behavior
is exercised by integration tests. Generated Prisma source alone is excluded
within `src/`. Business-module thresholds
remain at least 80%; the denominator includes HTTP DTOs, module composition,
bootstrap, logging, health and persistence. See root `coverage.txt` for the
separate aggregated business figures and baseline unit-only measurement.

## Remaining M5 gate

The installed Render CLI reports `unauthorized`; Blueprint account validation also
requires a selected workspace. No service, database, paid plan or public URL has
been created. The provider preference and whether to restore the intentionally
ignored application lockfiles remain pending user responses. Clean-clone npm ci,
Docker and CI require those lockfiles in the eventual user-created commit.

Finish by authenticating/selecting the hosting workspace, manually committing and
pushing reviewed files including the chosen reproducibility fix, provisioning
the reviewed Blueprint, setting actual public origins, and checking the seeded
hosted workflows/expiry/cold starts and first CI run. M5 remains **incomplete**
until live seeded UI/API and external evidence are verified. No commit hash or
completion date is invented for this work.

Graphify's existing graph was consulted before source inspection. It predates
the recent dashboard and M5 source changes and is marked stale; current source
and test results take precedence. No graph refresh is claimed.
