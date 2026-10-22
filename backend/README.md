# Clinic API

NestJS/TypeScript API for **Problem 2: Clinic Appointment Scheduler**, backed by
PostgreSQL 17 and Prisma 7. Start with the [root README](../README.md) for complete
configuration, business assumptions, deployment and reviewer instructions.

## Run locally

With Node 24, a configured local PostgreSQL database and `backend/.env`:

```sh
npm ci
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

`npm run db:prepare` combines migration deployment and fictional seeding against
this backend's configured `DATABASE_URL`. The seed preserves existing edits.
Normal runtime does not seed unless the deployment launcher receives
`SEED_DEMO_DATA=true`. From the repository root, `npm run dev:seed` instead provides the
container stack without installing PostgreSQL on the host.

The Dockerfile builds one backend image containing the API, migrations and seed
scripts. Its startup launcher migrates before serving HTTP. From a running
container stack, use `docker compose exec backend npm run db:prepare` at the
repository root to migrate and seed the same database.

Default API: http://localhost:3000. Swagger: http://localhost:3000/docs.
`/health/live` reports process liveness; `/health/ready` checks the migrated DB.

## Verify

From the root, `npm run coverage` runs every required backend/browser suite
against disposable Docker databases and retains backend coverage. Native
`npm run test:all` and `npm run test:cov:all` require an isolated
`TEST_DATABASE_URL` named `kjbn_test_*`; never point them at clinic/hosted data.
`npm run lint` applies fixes; use `npx eslint "{src,apps,libs,test}/**/*.ts"` for a
read-only source check. See [coverage scope](../coverage.txt).

## Ownership

Feature controllers map validated DTOs and explicit responses. Application use
cases orchestrate protected transactions through domain-owned ports; pure policies
own R1–R7. Infrastructure owns Prisma and database conflict translation. A frozen
request clock supports the documented review mode. See
[M2 rules/concurrency](../docs/m2-verification.md),
[M3 API evidence](../docs/m3-verification.md), and
[deployment/recovery](../docs/deployment.md).
