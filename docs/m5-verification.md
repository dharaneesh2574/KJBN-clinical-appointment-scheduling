# M5 — deployment and operability evidence

Date: 2026-10-20. M0–M4 gates preceded this work. Existing dashboard/calendar
changes remain preserved and uncommitted. No Git stage, commit or push was made.

## Implemented

- Non-root service Dockerfiles and a persistent local Compose stack were
  verified. The current packaging uses a single backend image containing API,
  migration/seed scripts and verification dependencies; the 2026-10-22 follow-up
  below records its verification separately from this historical milestone.
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

The full gate initially caught missing lint/formatter configuration in its
container and a non-root coverage-directory permission. Both were corrected.
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

## Subsequent M6 audit (2026-10-20)

The user manually committed the M5 implementation and M4 follow-ups as `eff65d8`
and the remote HEAD matches it. Statements above about uncommitted work describe
the original M5 boundary. Full M5 remains incomplete: a fresh committed clone
omits both intentionally ignored lockfiles and `docker-compose.verify.yml`;
hosting/anonymous CI evidence is unavailable. The pre-existing untracked Compose
file and UI readiness change are preserved for the eventual reviewed commit.
See [M6 verification](m6-verification.md) for current packaging/release status.

## Backend image consolidation - 2026-10-22

User decision: keep migration and sample-data scripts in the backend application
and its single Docker image. The main Compose file now contains exactly `db`,
`backend` and `frontend`, using PostgreSQL and the two application images. The
backend image includes compiled API code, Prisma SQL/schema, the TypeScript seed
runner, required dependencies and the isolated verification suites. Its existing
startup launcher applies committed migrations before serving HTTP; seeding is
opt-in through a command or `SEED_DEMO_DATA=true`.

`npm run db:prepare` inside `backend/` runs `prisma:deploy` then `prisma:seed` against
its `DATABASE_URL`. The root `dev:seed` executes `prisma:seed` in the running
backend. The root shell helper runs `db:prepare` using that same backend image and
configured DB. Test Compose files use this image too, with separate disposable
PostgreSQL databases. Current operating instructions are in README and the
[deployment runbook](deployment.md).

Verified against the reviewable working tree, pending the user's manual commit:

| Check | Result |
| --- | --- |
| All three Compose files validate | Pass; main services/images are exactly db/backend/frontend |
| Backend image build and read-only lint | Pass; API process runs as UID 1000 |
| Full `npm run coverage` | Exit 0; 220 backend tests / 10 suites and 27 real-API browser cases (1.3 minutes) |
| Coverage | Unchanged: overall 1195/1226 lines (97.47%); business 422/431 (97.91%) |
| Fresh `npm run dev:seed` | Pass on disposable `kjbn-clinic-image-check` project, ports 18083/13003; two seeded doctors and four reference-day appointments |
| Explicit shell migration/seed helper | Pass using backend `db:prepare`; API-edited weekly hours remain identical after re-seeding |
| Subsequent `npm run dev` | Pass; all three disposable services healthy |
| UI proxy and OpenAPI | Real frontend `/api/health/ready` and backend `/docs-json` pass |
| Startup/restart and DB outage/recovery | Liveness 200 throughout; readiness 200 → 503 → 200; migrations/seed replay on fresh tmpfs schema |
| Normal clinic update | Three healthy services; row counts and ordered-row fingerprints for all seven domain tables unchanged |
| Obsolete container/image cleanup | Exited migration/test containers and retired project image tags removed; current clinic volume retained |

The first verification attempt encountered Docker VM ENOSPC before Jest could
create its temporary directory. Removing the identified retired backend build
cache records recovered 7.3 GB; no unrelated application images or volumes were
pruned. A later check observed API recreation during its restart sequence after
a shared image rebuild. Health waits now use `--no-recreate` to preserve the
restarted container instead of replacing it during startup migrations. The focused
restart/outage loop and final full gate both pass. There were no business-rule
code changes.

This follow-up verifies local packaging, scripts and preserved data. Public
hosting, remote CI, final committed-clone verification and release tagging retain
their previously documented pending status. No files were staged, committed or
pushed. Earlier milestone measurements above remain historical evidence.

## CI failure diagnosis and tests-only policy - 2026-10-22

User decision: CI should run tests and coverage, without documentation checks.
Removed `npm run docs:check` from the workflow and the full Git history checkout
used by that check. The manual checker remains available; it was not run here.

Read-only GitHub API inspection of both remote jobs established the actual cause:

- [Run 39655207536](https://github.com/dharaneesh2574/KJBN-clinical-appointment-scheduling/actions/runs/39655207536/job/119413528789),
  revision `0bd2f22`: checkout passed; Node setup failed with
  `Some specified paths were not resolved, unable to cache dependencies.`
  Installation, documentation checking and all tests were skipped.
- [Run 39444816467](https://github.com/dharaneesh2574/KJBN-clinical-appointment-scheduling/actions/runs/39444816467/job/118703799675),
  revision `eff65d8`: same Node dependency-cache failure; tests never started.

The workflow's `cache-dependency-path` points to `frontend/package-lock.json`.
Both application lockfiles existed locally but were ignored and absent from
those revisions. A manifest-only temporary checkout also reproduced `npm ci`'s
missing-lockfile failure. Disabling caching alone would not repair installation
or the backend Dockerfile's required lockfile COPY.

Both existing lockfiles now remain trackable for the user's next manual commit;
no dependency versions changed. Their dependency declarations match their
manifests, and a fresh temporary frontend `npm ci` succeeds. The full local
`npm run coverage` exits 0: 220 backend cases / 10 suites, 27 browser cases,
97.47% overall line coverage and 97.91% business-code line coverage. Existing
build/lint and startup/restart/outage/recovery gates pass; disposable stacks
are cleaned up. No documentation checker was run.

These results verify the local fix. A successful remote run remains pending the
user's manual commit/push including both lockfiles; no stage, commit or push was
performed and the failed historical runs were not rerun.
