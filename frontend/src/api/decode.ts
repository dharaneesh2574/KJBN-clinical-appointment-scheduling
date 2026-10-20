import type {
  Appointment,
  AppointmentStatus,
  AuditedAppointment,
  Availability,
  Doctor,
  History,
  LocalWindow,
  Page,
  Patient,
  PatientFlag,
  Slot,
} from "./types";

function invalid(): never {
  throw new Error(
    "The clinic returned an unreadable response. Refresh and try again.",
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return invalid();
  return value;
}
export function string(value: unknown): string {
  return typeof value === "string" ? value : invalid();
}
function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : invalid();
}
function boolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : invalid();
}
function nullable(value: unknown): string | null {
  return value === null ? null : string(value);
}
export function array<T>(value: unknown, decode: (item: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(decode) : invalid();
}
function status(value: unknown): AppointmentStatus {
  if (
    value === "BOOKED" ||
    value === "COMPLETED" ||
    value === "CANCELLED" ||
    value === "LATE_CANCELLED" ||
    value === "NO_SHOW"
  )
    return value;
  return invalid();
}
function flag(value: unknown): PatientFlag {
  if (value === "MOBILITY_ASSISTANCE" || value === "INTERPRETER_REQUIRED")
    return value;
  return invalid();
}
export function doctor(value: unknown): Doctor {
  const x = record(value);
  const slotMinutes = number(x.slotMinutes);
  if (slotMinutes !== 15 && slotMinutes !== 30) return invalid();
  return {
    id: string(x.id),
    name: string(x.name),
    speciality: string(x.speciality),
    slotMinutes,
    dailyCap: number(x.dailyCap),
    active: boolean(x.active),
  };
}
export function patient(value: unknown): Patient {
  const x = record(value);
  return {
    id: string(x.id),
    name: string(x.name),
    phone: string(x.phone),
    dateOfBirth: string(x.dateOfBirth),
    flags: array(x.flags, flag),
  };
}
export function appointment(value: unknown): Appointment {
  const x = record(value);
  return {
    id: string(x.id),
    doctorId: string(x.doctorId),
    patientId: string(x.patientId),
    startsAt: string(x.startsAt),
    endsAt: string(x.endsAt),
    status: status(x.status),
    reason: string(x.reason),
    cancelledAt: nullable(x.cancelledAt),
    depositAcknowledgedAt: nullable(x.depositAcknowledgedAt),
    rescheduledFromId: nullable(x.rescheduledFromId),
  };
}
export function audited(value: unknown): AuditedAppointment {
  const x = record(value);
  return {
    ...appointment(x),
    events: array(x.events, (item) => {
      const event = record(item);
      return {
        id: string(event.id),
        fromStatus: event.fromStatus === null ? null : status(event.fromStatus),
        toStatus: status(event.toStatus),
        occurredAt: string(event.occurredAt),
      };
    }),
  };
}
export function slot(value: unknown): Slot {
  const x = record(value);
  return { startsAt: string(x.startsAt), endsAt: string(x.endsAt) };
}
export function page<T>(value: unknown, decode: (item: unknown) => T): Page<T> {
  const x = record(value);
  return {
    items: array(x.items, decode),
    total: number(x.total),
    offset: number(x.offset),
    limit: number(x.limit),
  };
}
export function history(value: unknown): History {
  const x = record(value);
  const deposit = record(x.deposit);
  return {
    ...page(x, audited),
    patient: patient(x.patient),
    deposit: {
      required: boolean(deposit.required),
      penaltyCount: number(deposit.penaltyCount),
      windowStartExclusive: string(deposit.windowStartExclusive),
      asOf: string(deposit.asOf),
      reason: string(deposit.reason),
    },
  };
}
function window(value: unknown): LocalWindow {
  const x = record(value);
  return { startMinute: number(x.startMinute), endMinute: number(x.endMinute) };
}
export function availability(value: unknown): Availability {
  const x = record(value);
  return {
    weekly: array(x.weekly, (v) => ({
      ...window(v),
      weekday: number(record(v).weekday),
    })),
    overrides: array(x.overrides, (v) => {
      const row = record(v);
      return {
        date: string(row.date),
        reason: string(row.reason),
        windows: array(row.windows, window),
      };
    }),
  };
}
