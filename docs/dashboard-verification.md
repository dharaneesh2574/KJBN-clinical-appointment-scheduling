# M4 follow-up: reference-led dashboard and booking modal

Verified 2026-10-20; pending manual commit. Builds on the user's M4 commit
`9197ec5` and the preceding uncommitted calendar/payload follow-ups.

The default Dashboard now shows actual appointments for its selected IST date,
including Booked, Completed, Cancelled, Late-cancelled and No-show. Four totals
summarize that day's actual data; cancelled includes late cancellations. Status,
doctor and patient/reason search filters affect the list. A right-side month
calendar and date jump update the selected date; phone layouts use a compact date
control. Rows open the existing appointment details/actions/history.

Book appointment opens a three-stage modal: patient/doctor, date/time, confirmation.
Patient lookup/registration uses the existing API. A doctor must be selected before
availability loads. Seven date cards show actual free-slot counts; morning,
afternoon and evening groups use real API times. Occupied appointments appear as
disabled, crossed-out chips. No-slot/loading/error states and the 60-day range are
explicit. Confirmation reuses the protected booking use case; a successful booking
returns to the dashboard on its booked date. Patient/reason survive choosing a new
slot. Existing day-grid quick booking and confirmed click/tap/keyboard/drag moves
remain available through Schedule.

All data is real local API data; no final-build mock catalog or fabricated counts
were added. The user's references guide the structure while the clinic's teal
theme remains. No source photos/branding are embedded. Phosphor React 2.1.10 (MIT)
provides the new icons. See root `design-qa.md` for browser source capture, combined
comparisons and resolved visual findings.

Verification: full isolated PostgreSQL/API Playwright gate **27/27 passes**; strict
frontend build and ESLint pass. The new cases cover status/calendar/filter/search,
occupied slots, saving onto another date, empty leave days, retained patient and
375/320px layouts. Existing 24 cases are retained/adapted, including move/deposit
and weekly-window regression checks. Initial selector and overlapping test-fixture
date mistakes were corrected before the complete passing run.

Native Vite preview exposed an existing `/api` proxy prefix error (404); its rewrite
now matches nginx and reaches `/doctors` etc. This path was verified in the in-app
browser against the normal local API without submitting clinic mutations. Browser
errors were checked; source and implementation screenshots were compared directly.
The frontend container was rebuilt and the dashboard verified at localhost:8080
through nginx with actual seed records and no console errors. Backend code and
its preceding 214-test gate are unchanged; backend suites were
not rerun for this frontend task. New install/builds used existing on-disk lockfiles;
the previously documented ignored-lockfile clean-clone limitation remains.

Graph context predates these changes and is marked for refresh. Source/test/visual
results above take precedence; no graph freshness is claimed. All implementation,
documentation and test changes remain unstaged/uncommitted for manual review.
