# M4 follow-up: calendar booking and moves

Implemented 2026-10-20, pending the user's manual commit. This extends the M4
baseline (`9197ec5`) and preserves the preceding weekly-window payload fix.

## Interaction

- Click a free slot to open a compact side panel with doctor, IST date, time and
  duration already selected. Find/select an existing patient or register one,
  enter the visit reason and confirm. Registration stays behind an explicit action.
  Doctor/date/time inputs are not repeated in the panel.
- The main Book appointment action takes the user to the schedule to choose a slot.
- Open a Booked appointment and choose Move appointment. A focused Move heading
  and banner explain the original slot and the next action. Change the day or
  doctor column, then click/tap/keyboard-activate a highlighted free slot.
- The confirmation panel shows From/To, automatically loads the existing patient's
  current eligibility and carries the original reason. Reason editing is optional.
  Confirm move calls the existing atomic reschedule endpoint. Starting a move from
  today's queue also opens the schedule.
- Desktop users can drag a Booked card to a visible free slot on either doctor's
  column. Dropping opens the same confirmation panel; it never submits a write.
  Cross-day moves use Move mode/date navigation. Dragging is an optional shortcut;
  clicks, taps and keyboard activation provide the same operation.
- Choose another slot preserves the selected patient, reason and acknowledgement
  in page memory, refreshes slots and returns to the schedule. Back/close discards
  the panel draft; Cancel move exits Move mode without changing the appointment.

## Correctness and boundaries

The existing API client and API-returned slots remain authoritative. The panel
rechecks its selected slot, disables confirmation while unavailable/loading, and
shows actual errors. A rejected booking preserves patient/reason. A rejected move
leaves the original Booked through the existing backend transaction; the UI never
cancels separately. Neither moves nor bookings retry writes automatically.

Deposit acknowledgement appears only when required by current eligibility or a
`DEPOSIT_REQUIRED` response. A late move can create the second penalty inside the
transaction, even when pre-move eligibility is clear. The UI exposes acknowledgement
after that rejection and permits a deliberate retry; the first attempt rolls back.
No backend policy, endpoint, schema or dependency was changed.

## Verification

- Strict frontend build and ESLint pass.
- Full isolated real-API/PostgreSQL Playwright suite: **24/24 pass** (19 existing
  cases retained/adapted, five new cases). The initial run's cancellation-history
  assertion had a missing test variable; it was corrected before the full pass.
- Tests verify compact booking without repeated selectors, conditional deposit
  controls, rejected slot recovery with retained draft, rejected/valid atomic
  moves, keyboard moves across days and 15/30-minute doctors, drag confirmation,
  375/320px tap move cancellation preserving original status/time/reason/events,
  and late-move deposit acknowledgement. Existing registration, flags, history,
  queue, clock, loading/outage and weekly-window tests remain covered.
- Screenshots under ignored `frontend/test-results/` were inspected for the desktop
  and phone panels. Keyboard focus/escape uses the existing native dialog behavior.
- After a time-label cleanup and adding queue-entry coverage, the four affected
  booking/move cases passed again. The frontend container was rebuilt for port 8080.
- Backend gates remain the preceding verified 214 tests; backend code did not
  change and that entire suite was not rerun for this frontend follow-up.
- Normal clinic data is not used for browser writes. Tests deploy committed SQL
  migrations into the disposable test Compose project and tear it down afterwards.

The graph used for initial navigation predates this follow-up and is marked for
refresh; these source/test results take precedence. The browser gate covers
Chrome, not all touch hardware or browsers. Native drag behavior is verified on
Chrome; mobile users use the equivalent tap flow.
