# Domain model

Terms are defined in [GLOSSARY.md](../GLOSSARY.md). Numbered decisions live in
[README section 8](../README.md#8-business-rules-and-assumptions).

```mermaid
erDiagram
  Doctor ||--o{ WeeklyAvailability : works
  Doctor ||--o{ AvailabilityOverride : overrides
  AvailabilityOverride ||--o{ AvailabilityWindow : replaces_day_with
  Doctor ||--o{ Appointment : attends
  Patient ||--o{ Appointment : books
  Appointment ||--o{ AppointmentStatusEvent : records
  Appointment o|--o| Appointment : replaced_by
```

| Entity | Meaning and representation |
| --- | --- |
| Doctor | UUID, name, speciality, 15/30-minute slot length, positive daily cap, active status |
| WeeklyAvailability | One doctor's ISO weekday and one half-open local-minute window |
| DateOverride / AvailabilityOverride | Unique doctor + local calendar date and reason; child windows replace the whole day |
| AvailabilityWindow | A window belonging to a date override; an empty parent's collection means leave |
| Patient | UUID, name, normalized unique E.164 phone, date-only DOB, assistance flags |
| Appointment | Doctor/patient references, UTC start/end, slot snapshot, status, reason, cancellation/deposit times, original reschedule reference |
| AppointmentStatusEvent | Booked creation or final-status event with occurrence instant; M2 writes it with the appointment transaction |

Pure TypeScript types and creation validators live under each feature's `domain/`
folder. `common/domain/validation.ts` contains actual shared value validation only.
Prisma persistence types stay outside domain code. M2 application ports and
adapters now serve real use cases; M3 adds explicit HTTP response DTO mappings.

## Storage invariants

The initial SQL migration is generated from the Prisma schema, then extended with
named checks and GiST exclusion constraints. PostgreSQL `btree_gist` supplies UUID
and weekday comparisons. Half-open `tstzrange` constraints prevent occupied
appointments overlapping for a doctor or patient, including concurrent inserts.
Booked, Completed, and No-Show participate; both cancellation statuses release the
interval. Local-minute `int4range` constraints prevent overlapping weekly/override
windows. Adjacent intervals are permitted.

Other checks enforce positive caps, valid slot lengths/durations, non-empty text,
normalized phone format, bounded DOB dates, cancellation timestamp consistency, and
recorded event transitions. Foreign keys restrict deletion of history owners;
deleting a date override cascades only its own availability windows. Instants use
`timestamptz(3)`; DOB/override dates use `date`; recurring windows use local minutes.

These constraints do not enforce availability selection, grid alignment, daily
caps, penalty eligibility, horizon, lifecycle transitions of the appointment row,
or complete history writes directly in SQL. M2 evaluates these inside a protected
application transaction using a clinic-wide advisory lock before its first read.
All application writers, schedule/settings edits, and explicit seed imports share
that lock. Real-DB use-case races, atomic rollback and bounded busy responses pass;
see [M2 verification](m2-verification.md). A preflight query outside this boundary
is insufficient. The original R1–R7 TODO inventory is now executable.

## Fictional seed catalog

Reference: **2026-10-19 08:30 IST** (`2026-10-19T03:00:00Z`).

- Two doctors: 15-minute cardiology and 30-minute general medicine, caps 12 and 8.
- Monday–Friday 09:00–12:00 and 14:00–17:00 local windows.
- Doctor one's leave on October 20; doctor two's extra Sunday clinic on October 25.
- Four explicitly fictional patients using reserved `+1 202-555-01xx` numbers.
- Nine appointments covering all five statuses, an acknowledged deposit case,
  a two-penalty patient, a one-penalty patient, and a linked reschedule.
- Fourteen status events, including initial booking history and final states.

`npm run prisma:seed` runs one locked transaction of stable-ID insert-if-missing
upserts, then checks resulting occupied schedules/caps before commit.
It preserves edits and never deletes records. A conflict with existing user data
rolls back the catalog transaction rather than silently rewriting it. Seed only
when explicitly requested; normal container startup runs migrations, not seed.
The reference is fixed so penalty/history examples do not change between runs.
M3 binds the validated clock snapshot to each HTTP request and trusted review-mode
configuration. Its DOB migration replaces the database wall-clock future check;
application validation uses the same request snapshot. See [M3 evidence](m3-verification.md).

## Primary references

- [Prisma 7 migration workflow](https://www.prisma.io/docs/orm/v7/prisma-migrate/getting-started)
- [PostgreSQL range exclusion constraints](https://www.postgresql.org/docs/17/rangetypes.html#RANGETYPES-CONSTRAINT)

M5 re-seed correction: availability is initialized only when its seed doctor is
first created. Existing doctors retain all weekly windows, intentionally closed
days, leave windows and deleted overrides, including replacement row IDs. An
edit-and-reseed PostgreSQL regression failed before this correction and passes
afterward. Other missing catalog entities remain additive; schedule conflicts
still roll the complete seed transaction back.
