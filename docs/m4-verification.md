# M4 UI — verified 2026-10-20

M3's actual manual commit is `f07683a`; its API/business-rule gate was re-run before
completing M4. The user's M4 manual commit is `9197ec5`; the follow-up fix below is
verified and pending manual commit. The assistant did not stage, commit or push changes. Pre-existing user
staging, including lockfile removals, was preserved.

## Implemented product flows

- **Schedule:** per-doctor IST day grid, available and occupied slots, 15/30-minute
  durations, status labels, cancelled-history disclosure, capacity counts,
  doctor filter, date navigation, today shortcut and explicit refresh.
- **Booking:** choose an API-returned slot; look up a normalized international
  phone or register a patient; show assistance flags and current penalty reasons;
  require deposit acknowledgement when the API says it is required. Reason and
  patient selection survive a rejected write. Refresh slots after rejection and
  require a new choice when the old slot disappears. The API rechecks all rules.
- **Appointment lifecycle:** latest details/status events, explicit cancellation
  confirmation, completed/no-show after appointment end, and atomic rescheduling
  with an existing patient, another doctor/date and valid slots. Show the linked
  original reference on a replacement. A failed reschedule preserves the original
  in PostgreSQL, verified through HTTP.
- **Patients:** exact phone search, registration, profile edits, explained
  assistance/deposit flags, paged appointment history (20 per page), doctor/reason/
  status and expandable audit events. Penalties come from the API independently of
  the visible page and expire as reviewer time advances.
- **Today's queue:** current IST day, time ordering, doctor filter, default Booked
  view, optional completed/no-shows, and appointment actions through details.
- **Clinic settings:** create/edit/activate/deactivate doctors; slot length/cap;
  multiple weekly working windows; whole-date leave/extra-day overrides; explicit
  restoration of weekly hours. Protected-edit conflicts show affected appointment
  references; the UI never silently cancels or changes an existing visit.

Every final-build record and mutation uses the real JSON API. There is no fallback
mock catalog, fake success, or hard-coded doctor/patient data in `frontend/src/`.
Only the dedicated browser-test fixtures contain fictional catalog records.

## Frontend boundaries and state

`src/api/` owns explicit frontend contracts, narrowing of unknown JSON, error-code
explanations, bounded-page retrieval and the shared fetch transport. Feature views
live under `features/schedule`, `features/patients`, and `features/clinic`.
`shared/` owns reusable status/error/loading/empty/dialog/pagination components,
abortable resources and IST formatting. The backend remains the sole scheduling
rule authority. UI end-time/deposit/status hints cannot bypass its checks.

Queries cancel on unmount/parameter changes and hide previous results while a new
query key loads. Successful writes refresh affected views; rejected writes show
safe codes/correlation references and keep recoverable inputs. Network/timeout
failures advise checking the latest schedule before retrying; writes are never
retried automatically. No patient data or reviewer setting is saved in browser
storage. Applying reviewer time remounts request-dependent state, avoiding stale
history or slots from another clock.

`VITE_API_BASE_URL` controls the origin at build time. Containers use `/api` through
nginx. Native Vite has an `/api` proxy to 127.0.0.1:3000 when no public origin is
configured; the existing `.env.example` also supports a direct configured origin.
All displayed instants and date math explicitly use Asia/Kolkata. Browser tests
run in America/Los_Angeles to catch accidental host-timezone conversion. The
reviewer panel accepts an explicit-offset timestamp, sends `X-Review-Now` on all
requests, and can return to real time; backend REVIEW_MODE still controls access.

## Accessibility and responsive checks

Native labelled controls, headings/regions, skip link, focus indicators, status/
alert messages, text status labels, reduced-motion support and native modal focus
containment are used. Modals support Escape and explicitly restore the opener's
focus after React unmounts the dialog. Pending appointment writes disable duplicate
submission/close. Mobile verification books a visit at 375×812, closes details by
keyboard, and checks 320×740 for page overflow. Desktop verification uses 1440×1000;
the built nginx UI was also visually inspected in the in-app browser.

An actual browser check exposed a CSS grid min-content width issue in the mobile
navigation. Shrinkable grid tracks and local navigation scrolling fixed the page
width without hiding overflow. A keyboard check exposed lost focus after dialog
unmount; capturing/restoring the connected opener fixed it. These were corrected
before the final full browser gate passed.

## Reproducible checks

From `frontend/`, with installed dependencies, Docker Compose v2 and Chromium:

```sh
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
```

`npm run build` enables strict TypeScript and checks both application and browser
test/config sources. `test:e2e` runs `scripts/test-e2e.mjs`: start the separately
named `kjbn-clinic-ui-tests` Compose project (forced with `--project-name`, so an
exported COMPOSE_PROJECT_NAME cannot redirect its startup or cleanup) from root `docker-compose.ui-test.yml`,
apply real committed SQL migrations to PostgreSQL 17 on tmpfs, expose only its test
API at 127.0.0.1:3011, let Playwright manage Vite at 127.0.0.1:4173, run fixtures and
browser workflows, and tear down only that test project in `finally`. It neither
seeds nor wipes the normal clinic database. Stop a forcibly interrupted test stack
with `docker compose --project-name kjbn-clinic-ui-tests -f docker-compose.ui-test.yml down --volumes`.

This machine used its installed Chrome executable instead of downloading Chromium:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e
```

Final results:

- Frontend strict build: pass. Read-only ESLint: pass.
- **18 Playwright cases pass**: real booking/registration/duplicate phones,
  flags/deposit acknowledgement, stale slot conflict with preserved inputs,
  failed/valid rescheduling and links, cancellation/late-cancellation/expiry,
  today queue completion/no-show, history pagination/profile edits, protected
  availability/leave/restore, weekly/extra-day edits, doctor settings, loading,
  outage/reconnect, rejected review time, keyboard focus and responsive layouts.
  One case specifically checks IST midnight/year/leap-date utilities.
- The preceding **214 backend tests pass again**: 113 unit/acceptance, 1 HTTP smoke,
  70 real-DB API cases and 30 other PostgreSQL cases. No backend source or business
  policy was changed by M4. M3's recorded combined coverage remains 97.48% overall
  backend lines and 97.91% business lines; frontend coverage is not claimed.
- The frontend production Docker build and nginx `/api` path were checked against
  the existing running clinic API. Read-only day navigation returned seeded doctor
  schedules and real slots; no normal clinic record was mutated by those checks.

Playwright HTML report, traces and screenshots are ignored under
`frontend/playwright-report/` and `frontend/test-results/`. The tests primarily use
real responses. Outage/loading cases deliberately abort or hold a network request;
they do not supply fabricated business data or substitute final-build API behavior.
Early harness failures (hidden event counts, worker restart fixture collisions and
label selectors) were corrected as well; final success is from a complete run.

## Follow-up: saving existing weekly hours (2026-10-20)

The user reported a failed PUT for doctor `10000000-0000-4000-8000-000000000002`,
weekly day `1`. Backend logs identify 400 `VALIDATION_FAILED`. The UI's loaded
weekly windows retained response-only `weekday`; serializing those objects sent
it inside each window, although the write DTO accepts only `startMinute` and
`endMinute` (weekday is already in the URL). Numeric minute values were valid.

A real browser regression first failed with the captured body
`{"windows":[{"startMinute":480,"endMinute":720,"weekday":1}]}` and HTTP 400.
The API client now explicitly projects the allowed window fields for weekly and
override writes. Strict backend validation remains in force. The regression then
returned 204 with `{"windows":[{"startMinute":480,"endMinute":720}]}`.
The initial 18-case suite covered new windows but missed this loaded-window save.

Verification: targeted regression passes; full isolated real-API/PostgreSQL
browser suite **19/19 passes**; strict frontend build and lint pass. Rebuilt only
the local frontend container and confirmed port 8080 serves the new bundle.
Normal clinic hours and appointments were not changed during verification.
The existing graph was used for navigation; it has not been refreshed for this
small follow-up, so source and test evidence above take precedence.

## Limits and remaining gates

The automated browser gate covers Chrome, not every browser/device or a full
accessibility audit. Public hosting, CI, database readiness, clean-clone/hosted
edge-case verification and final submission/tagging remain M5/M6. The local app
has no authentication (optional in the assignment) and no stretch features.

Both npm lockfiles were staged for removal by the user during this task, while
remaining on disk. Verification used those on-disk files. The current `npm ci`
and Docker COPY/install paths require lockfiles; their staged removal must be
reconciled before claiming a runnable clean clone. No index changes were made to
resolve the user's Git choice automatically.

Official references consulted: [React effects](https://react.dev/reference/react/useEffect),
[Playwright web servers](https://playwright.dev/docs/test-webserver), and
[Playwright configuration](https://playwright.dev/docs/test-use-options).
