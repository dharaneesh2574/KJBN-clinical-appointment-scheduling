# Clinic frontend

React/TypeScript and Vite UI for **Problem 2: Clinic Appointment Scheduler**.
The dashboard, booking modal, per-doctor grid, patient history, queue and clinic
settings call the real NestJS API. See the [root README](../README.md) for the
complete setup, assumptions, reviewer clock and release status.

## Run locally

With Node 24 and the backend running:

```sh
npm ci
npm run dev
```

Vite defaults to http://localhost:5173 and proxies `/api` to local port 3000 when
no API origin is set. Optional `.env` uses public `VITE_API_BASE_URL`; it is embedded
at build time, so never put secrets there. Containers use the nginx `/api` proxy.
From the root, `npm run dev:seed` starts the whole local container stack.

## Verify

```sh
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite creates and removes only its disposable PostgreSQL/API project;
ports 3011 and 4173 must be free. It never tests a public deployment. An existing
Chrome executable can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
Root `npm run coverage` combines the backend and browser gates. All dates/times
are displayed in Asia/Kolkata even when the browser uses another timezone.

## Design and evidence

[UI verification](../docs/m4-verification.md),
[calendar interaction](../docs/calendar-interactions.md), and
[dashboard/modal evidence](../docs/dashboard-verification.md) describe the tested
flows. The root README credits the supplied visual references and MIT Phosphor
icons. There is no production mock-data fallback. Broader browser/accessibility
coverage and hosted verification remain qualified in
[M6 release evidence](../docs/m6-verification.md).
