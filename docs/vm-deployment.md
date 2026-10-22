# VM deployment — 2026-10-22

M5 deployment follow-up. M0–M4 were already verified. The user selected this VM
instead of the prepared Render option and authorized image publication, SSH,
fresh database initialization and public deployment. The three services are
healthy and publicly reachable; the checks below passed.

## Layout and access

- Host: `35.244.38.53`, Linux AMD64; SSH user `dharaneeshnatarajan2574`.
- Runtime directory: `/home/dharaneeshnatarajan2574/kjbn`.
- `docker-compose.yml`: registry-only three-service stack, copied from
  [the VM configuration](../deploy/vm/docker-compose.yml).
- `.env`: generated on the VM with a random 32-byte hex database password, mode
  `0600`; never copied into Git. Public settings are illustrated in
  [the example](../deploy/vm/.env.example).
- `data/postgres/`: PostgreSQL bind mount; all application persistent volumes
  live under this directory tree. No named volumes or host PostgreSQL service.
- Docker itself manages image layers, containers and rotated stdout/stderr logs
  in its normal engine storage. `docker compose logs` reads those logs.
- Frontend: `http://35.244.38.53/`; direct API: `http://35.244.38.53:3000/`.
- Swagger: `http://35.244.38.53:3000/docs/`; schema:
  `http://35.244.38.53:3000/docs-json`.
- Public ports: nginx on 80 and the backend directly on 3000. PostgreSQL has no
  host port. The frontend still uses same-origin `/api/` forwarding. Backend CORS
  explicitly allows `PUBLIC_ORIGIN` and `BACKEND_ORIGIN`; no wildcard is enabled.
- Reviewer mode is enabled for this fictional assignment demo. Authentication
  remains absent. HTTP is configured; TLS/domain setup is not part of this run.

The directory was empty, and Docker had no existing containers or volumes before
deployment. No existing database was erased or reset. The new `.env` is not a
copy of the local development password.

## Published images

The initial application images were built from the backend/frontend source at
local commit `c199607` (no application source changes in the initial deployment),
using their existing lockfiles and Dockerfiles. Builds explicitly target
`linux/amd64`; the pre-existing local `latest` images target ARM64.

| Repository/tag | Pinned registry digest |
| --- | --- |
| `dharaneesh2574/kjbn-backend:vm-20261022-c199607` | `sha256:626b22f91aef53320b0d6bb3b5bd7334fefacaacf0da916857e6f42d0b6926a5` |
| `dharaneesh2574/kjbn-frontend:vm-20261022-c199607` | `sha256:bd966c2d2c11a0851dcea6d5404581674766f17d12cd845aa11a533333f3dc49` |
| `postgres:17-alpine` | `sha256:1bcc18d81671b02906296aad470ec9778a6b71016ce953092024b680bad007b0` |

The VM `.env` uses `repository@sha256:…` references for all three images.
Application images are pushed to Docker Hub using the existing local registry
login; the VM pulls them using its existing registry login. SSH private keys and
registry credentials remain in their existing credential locations.

## Startup, updates and seed

SSH using the user's existing local identity:

```sh
ssh -i /Users/dharaneeshnatarajan/.ssh/id_ed25519 \
  dharaneeshnatarajan2574@35.244.38.53
cd ~/kjbn
docker compose config --quiet
docker compose pull
# Initial provisioning only: start the fresh DB, migrate, explicitly seed.
docker compose up -d --wait db
docker compose run --rm --no-deps backend npm run db:prepare
docker compose up -d --wait --wait-timeout 180
```

Normal restarts need only `cd ~/kjbn && docker compose up -d --wait`.
All services use `restart: unless-stopped`. Backend startup deploys committed
migrations before serving; automatic startup seeding is disabled. Explicit seed:

```sh
docker compose exec backend npm run db:prepare
docker compose ps
docker compose logs --tail=100 backend
curl -f http://127.0.0.1/api/health/ready
```

Seed data remains anchored to `2026-10-19T03:00:00Z`: two doctors, four fictional
patients, weekly windows, leave/extra-day overrides and nine appointments. Use
the UI's Reviewer clock or `X-Review-Now` to explore those historical fixtures.
An empty queue on the actual current date is expected. Re-seeding is additive,
preserving existing edits and history.

For an update, build and push new AMD64 tags, update only the image references in
the VM `.env`, then run `docker compose pull && docker compose up -d --wait`.
Keep the database password and bind mount. `docker compose down` preserves the
bind-mounted database; do not delete `data/postgres` for an upgrade. For backup,
write `docker compose exec -T db pg_dump -U kjbn -d kjbn > backup.sql` in a
private backup directory under `~/kjbn`, and protect it as database data.

## Verification results

| Check | Result |
| --- | --- |
| Existing source and image builds | No backend/frontend source changes; strict production builds passed for AMD64 |
| Registry publication | Both image pushes succeeded; registry manifest inspection confirms digests and `linux/amd64`; VM pulled by digest |
| Fresh DB | Zero public tables before deployment; both committed migrations applied successfully; explicit `db:prepare` seed succeeded |
| Seed catalog | 2 doctors, 4 patients, 20 weekly windows, 2 overrides, 1 override window, 9 appointments, 14 status events |
| Initial runtime health | All three containers healthy; public readiness/liveness return 200; initially only frontend port 80 publicly mapped; direct-port follow-up below supersedes this binding |
| Public HTTP checks | 21 requests passed: UI/JS/CSS, health, OpenAPI/Swagger assets, doctors, all four fictional phone lookups, deposit history, leave/extra-day slots, malformed clock/body and allowed/denied CORS |
| Packaged backend tests on VM | Network-isolated container: 113 unit/acceptance cases and 4 mocked HTTP smoke cases passed; no deployed DB access |
| Additive re-seed | Counts and ordered full-row fingerprints unchanged across all seven domain tables |
| Full container recreation | `down` then `up -d --wait` completed in 17.10 seconds; all seven fingerprints unchanged; all three containers healthy afterward |
| Persistent volume location | Docker inspect confirms a single bind mount at `/home/dharaneeshnatarajan2574/kjbn/data/postgres`; no project named volumes |

The initial public home response measured 0.092 seconds from the local machine;
this is one warm request, not a latency benchmark. The 17.10-second recreation
measurement includes planned shutdown, migration-aware startup and health waits;
it excludes image downloads and initial seed. The VM has no Render free-database
expiry or configured provider sleep; continued availability depends on the VM.

The first ad hoc smoke check used an incorrect expected malformed-clock code;
the existing source/public response correctly returns `INVALID_DOMAIN_VALUE`.
The corrected 21-request check passed without an application change. All live
HTTP checks preserved clinic rows. No outage, concurrency or destructive test
suite was pointed at this persistent deployment.

This deployment does not establish the complete hosted R1–R7 edge-case matrix,
final committed clean-clone proof, current remote CI success or a release tag.
The Compose/runbook/documentation changes remain verified but pending the user's
manual commit. No staging, Git commit or Git push was performed. Existing graph
artifacts predate these new deployment files and have not been rebuilt.

## Direct backend and Swagger follow-up

The user requested direct backend access after Swagger's proxied page could not
execute API calls. The original check proved that the docs page and assets loaded,
but did not exercise "Try it out". OpenAPI has no explicit server URL, so Swagger
at `/api/docs/` targets root paths on port 80; `/doctors` there returns React HTML
while `/api/doctors` returns JSON. The evidence points to that base-path mismatch,
rather than CORS rejecting a correctly routed same-origin request.

Compose now publishes backend `3000:3000`; `.env` also sets
`BACKEND_ORIGIN=http://35.244.38.53:3000`. Swagger at the direct `/docs/` URL and
the API share one origin. Both the exact frontend and backend origins are in the
CORS allowlist. Use the direct Swagger URL above for API execution; the old
proxied docs URL retains the base-path limitation. No CORS relaxation was needed.
A browser execution check then found that pagination defaults were published as
OpenAPI objects, causing Swagger to throw before sending list requests. The
shared pagination DTO now declares integer schemas and explicit number types.
A generated-OpenAPI HTTP regression test covers doctors, appointments and
patient-history pagination. It failed before the fix and passes afterward.
The corrected backend is published as
`dharaneesh2574/kjbn-backend:vm-20261022-swagger`, pinned to
`sha256:d18981918fe6e8c25c53eef79b36cc9a0a51d99898af7f9a4dc019cbeadc7d91`.
The DB, bind-mounted data and frontend image remain in place.

Direct `/doctors` and `/docs/` both return HTTP 200 publicly. Browser "Try it out"
now executes `/doctors?offset=0&limit=20`, returning HTTP 200 and both seeded
doctors. Eleven public checks verify direct docs/schema/health, exact-origin
CORS preflights and invalid-body responses, denied origins, UI and its API proxy.
All six pagination query schemas across the three paginated routes are integers.
The production image build, targeted read-only ESLint check, 113 unit/acceptance
cases and five HTTP smoke/regression cases pass. Full integration/coverage and
browser suites were not rerun for this metadata/deployment correction. Cloud firewall inspection through the
VM service account was unavailable due to insufficient OAuth scopes; direct
external connectivity already succeeds, so no cloud firewall change was needed.
