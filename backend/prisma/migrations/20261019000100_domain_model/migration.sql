-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'COMPLETED', 'CANCELLED', 'LATE_CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PatientFlag" AS ENUM ('MOBILITY_ASSISTANCE', 'INTERPRETER_REQUIRED');

-- CreateTable
CREATE TABLE "doctors" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "speciality" VARCHAR(120) NOT NULL,
    "slot_minutes" INTEGER NOT NULL,
    "daily_cap" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_availability" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,

    CONSTRAINT "weekly_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_overrides" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" VARCHAR(500) NOT NULL,

    CONSTRAINT "availability_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_windows" (
    "id" UUID NOT NULL,
    "override_id" UUID NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,

    CONSTRAINT "availability_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "flags" "PatientFlag"[] DEFAULT ARRAY[]::"PatientFlag"[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "slot_minutes" INTEGER NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',
    "reason" VARCHAR(500) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    "deposit_acknowledged_at" TIMESTAMPTZ(3),
    "rescheduled_from_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_status_events" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "from_status" "AppointmentStatus",
    "to_status" "AppointmentStatus" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointment_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_availability_doctor_id_weekday_start_minute_key" ON "weekly_availability"("doctor_id", "weekday", "start_minute");

-- CreateIndex
CREATE UNIQUE INDEX "availability_overrides_doctor_id_date_key" ON "availability_overrides"("doctor_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "availability_windows_override_id_start_minute_key" ON "availability_windows"("override_id", "start_minute");

-- CreateIndex
CREATE UNIQUE INDEX "patients_phone_key" ON "patients"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_rescheduled_from_id_key" ON "appointments"("rescheduled_from_id");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_starts_at_idx" ON "appointments"("doctor_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_patient_id_starts_at_idx" ON "appointments"("patient_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_patient_id_status_cancelled_at_idx" ON "appointments"("patient_id", "status", "cancelled_at");

-- CreateIndex
CREATE INDEX "appointment_status_events_appointment_id_occurred_at_idx" ON "appointment_status_events"("appointment_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "weekly_availability" ADD CONSTRAINT "weekly_availability_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_override_id_fkey" FOREIGN KEY ("override_id") REFERENCES "availability_overrides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_status_events" ADD CONSTRAINT "appointment_status_events_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Custom structural invariants: Prisma's schema language cannot represent these.
-- [start,end) allows adjacent windows and appointments.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE doctors
  ADD CONSTRAINT doctors_slot_minutes CHECK (slot_minutes IN (15, 30)),
  ADD CONSTRAINT doctors_daily_cap CHECK (daily_cap > 0),
  ADD CONSTRAINT doctors_nonempty_text CHECK (length(btrim(name)) > 0 AND length(btrim(speciality)) > 0);

ALTER TABLE patients
  ADD CONSTRAINT patients_phone_e164 CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  ADD CONSTRAINT patients_nonempty_name CHECK (length(btrim(name)) > 0),
  ADD CONSTRAINT patients_dob_not_future CHECK (date_of_birth <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date);

ALTER TABLE weekly_availability
  ADD CONSTRAINT weekly_valid_window CHECK (
    weekday BETWEEN 1 AND 7 AND start_minute >= 0 AND end_minute <= 1440 AND end_minute > start_minute
  ),
  ADD CONSTRAINT weekly_windows_no_overlap EXCLUDE USING gist (
    doctor_id WITH =, weekday WITH =, int4range(start_minute, end_minute, '[)') WITH &&
  );

ALTER TABLE availability_overrides
  ADD CONSTRAINT override_nonempty_reason CHECK (length(btrim(reason)) > 0);

ALTER TABLE availability_windows
  ADD CONSTRAINT override_valid_window CHECK (
    start_minute >= 0 AND end_minute <= 1440 AND end_minute > start_minute
  ),
  ADD CONSTRAINT override_windows_no_overlap EXCLUDE USING gist (
    override_id WITH =, int4range(start_minute, end_minute, '[)') WITH &&
  );

ALTER TABLE appointments
  ADD CONSTRAINT appointments_duration CHECK (
    slot_minutes IN (15, 30) AND ends_at > starts_at AND
    ends_at - starts_at = slot_minutes * interval '1 minute'
  ),
  ADD CONSTRAINT appointments_nonempty_reason CHECK (length(btrim(reason)) > 0),
  ADD CONSTRAINT appointments_cancellation_time CHECK (
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND cancelled_at <= starts_at - interval '2 hours') OR
    (status = 'LATE_CANCELLED' AND cancelled_at IS NOT NULL AND cancelled_at > starts_at - interval '2 hours') OR
    (status IN ('BOOKED', 'COMPLETED', 'NO_SHOW') AND cancelled_at IS NULL)
  ),
  ADD CONSTRAINT appointments_no_self_reschedule CHECK (rescheduled_from_id IS NULL OR rescheduled_from_id <> id),
  ADD CONSTRAINT appointments_doctor_no_overlap EXCLUDE USING gist (
    doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('BOOKED', 'COMPLETED', 'NO_SHOW')),
  ADD CONSTRAINT appointments_patient_no_overlap EXCLUDE USING gist (
    patient_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('BOOKED', 'COMPLETED', 'NO_SHOW'));

ALTER TABLE appointment_status_events
  ADD CONSTRAINT appointment_events_valid_transition CHECK (
    (from_status IS NULL AND to_status = 'BOOKED') OR
    (from_status IS NOT NULL AND from_status = 'BOOKED' AND to_status IN ('COMPLETED', 'CANCELLED', 'LATE_CANCELLED', 'NO_SHOW'))
  );

-- Daily cap, effective availability, reviewer-time rules, and atomic history writes
-- must be evaluated by the protected application transactions introduced in M2.
