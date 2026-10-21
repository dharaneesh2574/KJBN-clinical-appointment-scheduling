# Reviewer and release checklist

This checklist separates assignment requirements from local evidence and remaining
hosted checks. Use only fictional fixtures in a dedicated reviewer deployment.
The ordinary test suites never target public hosting. No hosted row below is
marked passed without an actual deployed check and recorded result.

## Environment and release identity

Record the final commit, `v1.0` target, UI/API/OpenAPI URLs, creation/expiry dates,
review-mode setting and successful CI-run URL. Confirm the database remains
available for the entire review. Receipt date is unknown; do not invent a deadline.
`README.md` sections 5/5a contain startup and deployment instructions.

First confirm `GET /health/live` and `/health/ready` are 200, `/docs` opens,
`/docs-json` contains core routes, and the UI calls the actual configured API.
After a cold start, record the measured wait rather than quoting a provider's
estimate as an application measurement. Verify allowed UI CORS origin and lack
of an allow-origin grant for an unrelated origin.

## Core acceptance matrix

Local evidence comes from `backend/test/rules.acceptance.spec.ts`,
`scheduling.integration-spec.ts`, `domain.integration-spec.ts`,
`api.integration-spec.ts` and `frontend/e2e/clinic.spec.ts`. See M2–M5 evidence
for historical runs. Hosted results are currently **pending** for every row.

| ID | Required hosted checks | Existing local evidence |
| --- | --- | --- |
| R1 | Exact window opening and closing; appointment extending past closing; off-grid rejection; 15/30-minute doctors | Pure rule boundaries and actual booking workflows |
| R1 | Leave override closes day; extra-day override opens it; override replaces weekly windows completely | Rule, HTTP and UI availability cases |
| R2 | Two simultaneous requests for one doctor slot: exactly one succeeds | Real PostgreSQL concurrent requests/constraint checks |
| R2/R3 | Adjacent slots succeed; patient overlap across different doctors rejects | Half-open interval and concurrent patient tests |
| R4 | Cap minus one, at cap, beyond cap; both cancellation statuses release capacity | Rule and transaction tests |
| R4 | Concurrent requests for the last capacity at distinct slots; cap-edit race | Real PostgreSQL application tests |
| R1/R2 | Availability edit races a booking; occupied-window removal returns affected IDs | Protected-edit concurrency and HTTP/UI cases |
| R5 | Cancel at 2h01m, exactly 2h and 1h59m before start | Fixed-clock boundaries and API cancellation cases |
| R5 | Penalty counts 1/2/3, both lookback endpoints and automatic expiry | Pure policy and persisted history cases |
| R5 | Flagged booking rejects without acknowledgement and accepts with it | Rule/API/UI deposit cases |
| R6 | Invalid reschedule preserves original row/status/history; valid move links replacement | Real transaction rollback and browser workflows |
| Lifecycle | Repeated cancellation is stable; invalid transitions reject; completion/no-show only after end | Rule and API status/history tests |
| R7 | Past rejects, exact-now succeeds, inclusive 60-day boundary succeeds, later rejects | Fixed-clock policy/HTTP cases |
| Time | IST midnight, UTC date changes, month/year and leap-day boundaries | Domain and non-IST browser tests |
| Validation | Missing fields, wrong types, unknown properties, malformed dates/timestamps/UUIDs | Strict DTO API suite |
| Resources | Missing doctor/patient/appointment; duplicate normalized phones | Safe 404/409 and API persistence cases |
| Clock | Review mode enables explicit-offset request time; malformed/offset-free values reject; parallel overrides isolate | Request-clock unit and real HTTP cases |
| Clock | Disabled review mode rejects override; no global/system clock mutation | API tests and production configuration |
| Errors/logs | Consistent envelope and correlation ID; safe 500/503; no personal values, credentials or stacks | HTTP/error/log tests and DB outage/recovery |
| UI | Doctor grid, dashboard date/status filters, booking modal, confirmed reschedule/cancellation | Real-API Playwright workflows |
| UI | Phone lookup/history and explained flags; today's queue; loading/error/empty states | Real-API Playwright workflows |
| UI | Laptop and phone widths, keyboard dialog/focus controls, IST independent of browser timezone | 320/375/1440px and non-IST checks |
| Seed | Two fictional doctors, statuses, leave/extra-day and deposit examples; repeat seed preserves edits | Real PostgreSQL seed regressions and hosted-launcher local checks |

For boundary checks, create separate fictional appointments so earlier mutations
cannot invalidate later cases. Record request ID, expected/observed status/code and
time snapshot; do not copy patient data or raw server secrets into evidence.
For concurrent checks, keep both responses and verify final persisted counts.

## Reviewer walkthrough

1. Enable review mode deliberately, then set the UI reviewer time to
   `2026-10-19T08:30:00+05:30`; all displayed dates/times remain IST.
2. Open Dashboard and the right-side calendar, filter statuses, then inspect both
   doctors in Schedule. On the initial seed, one uses 15-minute slots and one 30.
3. Use Book appointment: select a fictional patient and doctor, choose an actual
   available date/time chip, then review and confirm. Inspect patient history.
4. Search fictional phone `+12025550103`: two recent penalties require deposit
   acknowledgement. `+12025550102` has one. Recheck the first history with reviewer
   time `2026-11-19T08:30:00+05:30` to observe expiry independent of pagination.
5. Attempt an invalid move and verify the original survives. Use Move mode or the
   modal for a valid replacement and inspect linked cancellation/replacement history.
6. For a 09:30 IST booking, cancellation at 07:29/07:30 is Cancelled; at 07:31 it
   is Late-Cancelled. Use different appointments for each check. Advance beyond
   an appointment's end to verify completion/no-show from today's queue.
7. Check the initial October 20 doctor-one leave and October 25 doctor-two extra
   Sunday. Re-seeding preserves edits; a fresh isolated database gives the exact
   original fixture. Clear reviewer time afterward.

## Final user-controlled release

- Include both chosen application lockfiles and `docker-compose.verify.yml` in
  the reviewed commit; clean-clone installation currently depends on them.
- Run `npm run docs:check` and `npm run coverage` with documented prerequisites.
  Repeat from a clone of the actual final commit, without copied ignored files.
- Verify all hosted rows and links; record CI and public repository visibility.
- Review credential/generated-file audit evidence and fictional seed data.
- The user manually commits and pushes M6 changes. Tag that verified revision
  `v1.0` only after all gates pass; never tag an earlier HEAD that lacks them.
- Prepare repository/live URLs, candidate name/phone and Problem 2 for the user's
  submission. Do not send email or invent missing candidate/contact details.
