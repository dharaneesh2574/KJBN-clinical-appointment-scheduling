# M5 deployment runbook

Status: local implementation verified on 2026-10-20; full M5 remains incomplete. No public service
has been created. The Render CLI returns `unauthorized`; account/workspace
validation and a live seeded verification remain external gates.

## Local stack

Use Node 24 and Docker Compose v2. From the repository root:

```sh
npm run dev:seed
```

This initializes `.env` from the sanitized example only if absent, builds the
services, applies committed migrations, waits for database/API/UI health, and
explicitly ensures the fictional seed. Existing `.env` is never overwritten.
Use `npm run dev` for subsequent startup without seeding. Set `COMPOSE_ENV_FILE`
for a different existing environment file. Normal data lives in Compose's named
volume; `docker compose down` preserves it. Do not use `down --volumes` on the
clinic project for routine upgrades.

Default UI: http://localhost:8080; API: http://localhost:3000; docs:
http://localhost:3000/docs. Native Vite uses its configured `/api` development
proxy. Docker nginx strips `/api/` before forwarding to the API root.

## Verification and CI

Install frontend dependencies and Chromium once:

```sh
npm ci --prefix frontend
cd frontend
npx playwright install chromium
cd ..
npm test
# All the same gates, with combined backend coverage retained on the host:
npm run coverage
```

Both commands build/lint and run rules, HTTP, real PostgreSQL migration and
concurrency suites, hosted startup/readiness checks, and the real-API browser
suite. Coverage is copied to ignored `backend/coverage/all/`. Only generated
Prisma source is excluded from the combined backend denominator. The committed
`coverage.txt` is a sanitized snapshot, not an automatically refreshed claim.

The test scripts explicitly name disposable `kjbn-clinic-verify` and
`kjbn-clinic-ui-tests` projects and remove only their containers/volumes. Their
PostgreSQL data uses tmpfs. Browser tests require free local ports 3011 and 4173.
No test targets public hosting or the persistent local clinic database.

`.github/workflows/verify.yml` runs the coverage gate on main/codex branch pushes,
pull requests to main, and manual workflow dispatch. It uses Node 24, installs
Chromium with Linux dependencies, and grants only repository read permission.
CI has no deployment credentials or production database access. A local pass
does not prove a GitHub Actions run occurred; verify its first remote run after
the user manually commits and pushes.

## Health and startup behavior

- `GET /health/live`: 200 `{ "status": "ok" }`, without a database query.
- `GET /health/ready`: 200 `{ "status": "ready" }` after a bounded read against
  the migrated `doctors` table. Missing schema or database failure returns 503
  `{ "code": "DATABASE_UNAVAILABLE", "message": "Database is temporarily unavailable", "requestId": "…" }`.
- Readiness uses a 1-second transaction acquisition limit, 1.5-second PostgreSQL
  statement timeout, 2.5-second transaction deadline and 2-second pool connection
  timeout. No background query is left by a JavaScript timeout race.
- Readiness failures use the existing single correlated error log. Driver errors,
  connection strings and patient data are never included in the response/log.
- Compose and Render route health checks to `/health/ready`. The historical `/`
  smoke route remains compatible; it does not indicate database readiness.

The verification gate starts the hosted launcher against a fresh isolated DB,
restarts it to reapply migrations and additive seed, stops the DB to observe
liveness 200/readiness 503, then restores migrations and readiness. Stopping a
tmpfs test DB intentionally discards its schema; a real hosted DB is persistent.

## Proposed Render topology and limits

`render.yaml` defines a free Node backend, free static frontend and free
PostgreSQL 17 database in Singapore. This is the prepared default while the user
chooses a provider. Native Node hosting uses the same build and migrations as
the Docker tooling image; retaining dev dependencies supplies Prisma CLI/ts-node
for migrations and the explicit fictional seed. Docker runtime remains lean.

The database accepts private-network connections only (`ipAllowList: []`), and
the backend receives its internal connection string through a database reference.
Neither credentials nor live URLs are invented in this repository. `btree_gist`
is supported and enabled by the committed migration.

Terms checked on 2026-10-20: free web services sleep after 15 idle minutes and can
take about a minute to resume; 750 free instance-hours are shared per workspace
each month. Free PostgreSQL has 1 GB, expires after 30 days and has no backups.
Static frontend hosting avoids consuming another sleeping web service's hours.
Do not choose a paid upgrade or enable spending without the user's approval.
Confirm the actual database expiry covers the entire review; no receipt date or
submission deadline is assumed. These are provider limits, not measured cold-start
results for this app.

## First deployment (dashboard steps)

1. Resolve the intentionally ignored application lockfiles before claiming a
   runnable clean clone. Both Docker and hosting/CI use `npm ci`, requiring the
   existing lockfiles in the user's eventual commit. That preference is pending.
2. The user manually reviews, commits and pushes the prepared implementation.
   No stage/commit/push is performed by this task. Log in with `render login`,
   choose the workspace, and validate with `render blueprints validate render.yaml`.
3. In Render, create a Blueprint from this repository and the intended branch.
   Confirm the two compute/database plans say **Free** and the UI is a static site.
   `autoDeployTrigger: checksPass` waits for successful repository checks.
4. Supply the actual frontend HTTPS origin as API `CORS_ORIGINS` (no path or
   trailing slash). Supply the actual API HTTPS root as frontend
   `VITE_API_BASE_URL` (without `/api`). Render prompts for these public settings;
   if a generated hostname differs, update both dashboard values and redeploy.
   Vite embeds its API URL at build time, so restarting the UI is insufficient.
5. Backend startup applies `prisma migrate deploy`, then the explicitly enabled
   additive seed (`SEED_DEMO_DATA=true`), then serves HTTP. Any failed step stops
   startup. It never resets the DB or uses `db push`. Render's free tier has no
   paid pre-deploy job, so the launcher owns this sequence.
6. This Blueprint is a fictional reviewer demo: `REVIEW_MODE=true` enables
   request-local time testing. Authentication is intentionally absent. Use only
   fictional data; disable reviewer mode for any separate ordinary deployment.
7. Verify UI, `/docs`, `/docs-json`, `/health/live`, `/health/ready`, allowed and
   denied CORS origins, two seeded doctors, patient history, a valid booking,
   overlap rejection, failed reschedule rollback, cancellation and penalty expiry.
   Use the documented reviewer reference instant for historical seed examples.
8. Record the actual URLs, deployment commit, creation/expiry dates, first CI run,
   cold-start duration and hosted workflow results in README/SUBMISSION and
   `docs/m5-verification.md`. M5 stays incomplete until these checks pass.

## Redeploy, re-seed and failures

Push reviewed changes manually and let successful CI trigger deployment, or use
Render's manual deploy action for the intended commit. Always keep migration SQL
in Git. A failed migration/startup must be diagnosed before retrying; never delete
the database to hide a migration failure. An applied migration is not undone by
rolling the application code back; use a compatible forward migration.

The seed uses stable fictional IDs, bootstraps availability only for newly
created seed doctors, skips existing rows, preserves edited/closed availability and
history, and rejects conflicting schedules atomically. While
`SEED_DEMO_DATA=true`, every explicit deployment/restart ensures that catalog. Set
it to `false` after initial provisioning if repeated seeding is unwanted. To
ensure it again, deliberately set it to `true` and redeploy, inspect the sanitized
success log, then optionally turn it off. Re-seed does not reset dates or restore
edits; the fixed reviewer examples remain anchored to 2026-10-19.

Inspect backend **Logs** in Render for startup, migration and correlated request
records. A failed readiness check keeps the service from being marked healthy.
During a DB outage, liveness can stay healthy while readiness returns 503; recover
connectivity/schema and recheck before accepting the deployment. Capture only
sanitized evidence. Never paste database URLs or access tokens into documentation.

## Primary references

- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Official Blueprint schema](https://render.com/schema/render.yaml.json)
- [Render free plans and expiry](https://render.com/docs/free)
- [Render PostgreSQL extensions](https://render.com/docs/postgresql-extensions)
- [Render deployment lifecycle](https://render.com/docs/deploys)
- [GitHub checkout](https://github.com/actions/checkout) and
  [setup-node](https://github.com/actions/setup-node)
