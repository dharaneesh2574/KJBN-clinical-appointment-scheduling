# Verification — 2026-10-19

## Milestones

- M0: `c9a3346`, validated/injected configuration, both env examples, README structure.
- M1: `7e795de`, domain types, migration, repeatable seed, decisions, test inventory.
- M5 local-container subset: explicitly requested early; full M5 remains open.

## Checks and observed results

| Check | Result |
| --- | --- |
| Backend strict TypeScript, build, read-only ESLint | Pass |
| Frontend ESLint and build | Pass |
| Backend unit tests | 25 pass |
| Mocked HTTP test | 1 pass (M0); subsequent running-stack HTTP smoke passes |
| Real PostgreSQL integration suite | 10 pass |
| R1–R7 acceptance inventory | 35 TODO, intentionally pending M2 |
| Unit coverage | 78.26% lines; see root coverage.txt for scope and other metrics |
| Root Compose validation and image builds | Pass |
| Fresh app database migration | Pass; 1 initial migration |
| Schema comparison after deployment | No difference detected |
| Explicit migrate-and-seed helper | Pass |
| App seed counts | 2 doctors, 4 patients, 9 appointments, 14 status events |
| Local frontend/backend/PostgreSQL | Healthy |
| nginx /api/ proxy | Returns backend greeting |
| CORS | Configured localhost origin included; unlisted origin excluded |

The separate `kjbn_test_m1` database uses tmpfs and no application volume. Its
integration suite applies migrations, tests FK/check/exclusion constraints,
concurrent doctor/patient inserts, adjacency, cancellation participation,
transaction rollback, local-date/UTC persistence, status-event checks, and seed
repeatability/preservation. It is stopped after verification. The app stack is
left running at localhost:8080 (UI) and localhost:3000 (backend).

The integration runner uses Jest's documented `--experimental-vm-modules` option
because the Prisma runtime performs dynamic imports. OpenSSL and explicit Prisma
engine preparation are present in the migration/tooling image. No dependency
errors were hidden or tests skipped to make verification pass.

## Scope limits

This evidence proves M1 structural persistence behavior, not complete R1–R7
application enforcement. Daily-cap and availability-edit transaction safety,
penalty/horizon policies, protected rescheduling use cases, validation/error API,
request-scoped reviewer clock, and integrated scheduling UI remain later gates.
The current container HTTP check calls the scaffold greeting; dedicated database
readiness remains M5. Images are built/tagged locally, not published to Docker Hub.
No public deployment, clean-clone hosted review, or final submission is claimed.

## References used

- [Prisma 7 migration workflow](https://www.prisma.io/docs/orm/v7/prisma-migrate/getting-started)
- [PostgreSQL range constraints](https://www.postgresql.org/docs/17/rangetypes.html#RANGETYPES-CONSTRAINT)
- [Compose startup order](https://docs.docker.com/compose/how-tos/startup-order)
- [Jest VM-module configuration](https://jestjs.io/docs/ecmascript-modules)
