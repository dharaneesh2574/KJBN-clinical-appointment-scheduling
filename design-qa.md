# Dashboard and appointment picker design QA

Date: 2026-10-20. Scope: the supplied dashboard/picker elements adapted to the
existing clinic theme and real API, rather than reproducing unrelated medical
modules, salon services, payments or the perspective presentation artwork.

## Visual truth and captures

- Dashboard: [Doctor Appointment Booking by Nasim](https://dribbble.com/shots/27618363-Doctor-Appointment-Booking).
  Opened/captured in the in-app browser; the observed first source image is
  `https://cdn.dribbble.com/userupload/48604074/file/0d12f1aced0d5e065dcc5e4378109397.png?resize=752x&vertical=center`.
  Local comparison copy: `/tmp/kjbn-dashboard-reference.png` (752 × 564).
- Picker: user-attached `codex-clipboard-a953b554-d271-45a2-9002-5a3cbae2eeda.png`;
  comparison copy `/tmp/kjbn-picker-reference.png` (511 × 424).
- Browser-rendered implementation: `http://127.0.0.1:4175/`, connected to the local
  API through Vite's corrected `/api` proxy. Normal clinic verification is read-only.
- Dashboard: `/tmp/kjbn-dashboard-before.jpg` and
  `/tmp/kjbn-dashboard-desktop-final.jpg`, both 1280 × 720 viewport captures;
  populated final state selects 19 October 2026, with four actual fictional seed
  visits. Additional full-page capture: `/tmp/kjbn-dashboard-after.jpg` at 1440 CSS
  pixels wide. Phone captures: `/tmp/kjbn-dashboard-phone.jpg` (full page, 375 CSS
  pixels wide) and `/tmp/kjbn-dashboard-phone-after.jpg` (375 × 812 viewport).
- Picker: `/tmp/kjbn-picker-desktop.jpg` before the contrast fix and
  `/tmp/kjbn-picker-after.jpg` after, 1440 × 1000 viewport; modal approximately
  730 × 693 CSS pixels at (355,154). State: existing fictional patient, Dr Ravi
  Demo, 21 October, selected 09:30–10:00 IST. Phone: `/tmp/kjbn-picker-phone.jpg`,
  375 × 812; dialog client/scroll width both 357, with no horizontal clipping.
- Full-view comparison inputs opened together:
  `/tmp/kjbn-dashboard-final-comparison.jpg` and
  `/tmp/kjbn-picker-final-comparison.jpg`. Focused time/selection/footer comparison:
  `/tmp/kjbn-picker-focused-comparison.jpg`.
- Density normalization: implementation viewport captures use one output pixel
  per CSS pixel. The 730-pixel picker crop was uniformly reduced to 511 pixels for
  comparison to the attachment. The dashboard source is a perspective poster;
  compare composition, hierarchy and controls, not distorted pixel coordinates.
  Different real appointment/availability counts are data differences, not drift.
  Temporary captures are local review evidence, not committed source assets.

## Findings and comparison history

1. **[P2, resolved] Summary layout delayed the appointment list.** The first
   dashboard put four summaries into two rows within the list column. The source
   puts them in a strip across the top. Moved the summary strip above the
   list/calendar split. The final matched 1280 × 720 capture shows four cards
   across, appointments below and the date calendar on the right.
2. **[P1, resolved] Selected time lost contrast under the pointer.** The initial
   picker hover rule lightened the selected background while retaining white
   text. The source uses a solid, readable selected pill. Added a selected-hover
   rule; the post-fix capture/comparison shows a dark teal pill with legible text.
3. **[P2, resolved] Mobile dashboard introduction displaced core content.** The
   initial phone view used the full desktop introduction. Reduced its heading
   and removed the redundant eyebrow/subtitle on phones. Recapture shows the date
   control, all four totals and the appointment panel heading within the 375 × 812
   view. The complete list remains scrollable.

## Required fidelity surfaces

- **Fonts/typography:** clean sans serif, clear names/counts/headings and secondary
  labels. Retained the project's Inter/system stack; the reference's exact font
  is unspecified. Phone heading fits one line at 375px. Long reasons truncate in
  list rows and remain readable in appointment details.
- **Spacing/layout:** full-width summary strip, list/calendar desktop split,
  rounded bordered panels, seven date cards, grouped pills and a distinct modal
  footer. At phone widths, the calendar becomes a compact native date control;
  time chips reflow to four columns and the modal scrolls vertically.
- **Colors/tokens:** retained clinic teal for active/selected controls, soft neutral
  surfaces and semantic status colors. The source's blue dashboard/maroon picker
  accents are intentionally adapted to the user's instruction to blend the theme.
  Selected hover contrast is resolved.
- **Images/assets:** no clinical photos exist in the product's patient/doctor
  records. Existing initial avatars are retained rather than inventing photos or
  embedding the reference's people, branding or poster as UI. New controls use
  the MIT-licensed Phosphor React icon library; no generated raster art is needed.
- **Copy/content:** clinic entities, five actual API statuses, real selected-day
  totals, real free-slot counts and occupied chips. Three clinic booking stages
  replace the salon's unrelated service/payment stages. Morning/afternoon/evening
  groups appear when that doctor has actual entries; empty groups are omitted.

## Interaction and verification

- In-app browser: changed calendar day, opened actual appointment details, opened
  booking modal, looked up/selected a fictional seed patient, selected a doctor,
  changed date/time, continued to review, returned to the picker, closed without
  submitting, checked 1280/1440 desktop and 375 phone layouts. Current browser
  error log check returned no console errors. Temporary viewport override is reset
  for handoff. The rebuilt production UI at `http://localhost:8080/` was then
  opened and the real seeded day selected; production console error check was
  empty. Final production capture is `frontend/test-results/dashboard-production.jpg`.
- Chromium real-API/PostgreSQL gate: 27/27 cases pass. New tests cover all lifecycle
  statuses and calendar/filter/search behavior; actual modal booking including a
  different booked date; occupied/leave days, phone widths and retained patient.
  Existing booking/conflict/flags/history/queue/reviewer-clock/move tests still pass.
- Early test failures were selector and shared-fixture-date mistakes; corrected
  before the complete pass. No backend rule, schema or endpoint changed.

## Open questions

None blocking. The user explicitly requested the existing clinic theme. This is
an adaptation of the named UI elements, not an exact copy of the artwork or its
unimplemented modules.

## Implementation checklist

- [x] Compare source and rendered app in combined full and focused inputs.
- [x] Correct and recapture every P1/P2 issue above.
- [x] Verify live calendar, filters, booking stages and responsive behavior.
- [x] Pass full browser tests, build and lint.

## Follow-up polish

P3: verify physical touch devices and additional browser engines. Long days use a
scrollable page; the poster's compressed type/density is not copied at the expense
of the existing clinic typography.

final result: passed
