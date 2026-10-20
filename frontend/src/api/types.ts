export interface Doctor {
  readonly id: string;
  readonly name: string;
  readonly speciality: string;
  readonly slotMinutes: 15 | 30;
  readonly dailyCap: number;
  readonly active: boolean;
}
export type DoctorInput = Omit<Doctor, "id">;
export type PatientFlag = "MOBILITY_ASSISTANCE" | "INTERPRETER_REQUIRED";
export interface Patient {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly dateOfBirth: string;
  readonly flags: readonly PatientFlag[];
}
export type PatientInput = Omit<Patient, "id">;
export type AppointmentStatus =
  "BOOKED" | "COMPLETED" | "CANCELLED" | "LATE_CANCELLED" | "NO_SHOW";
export interface Appointment {
  readonly id: string;
  readonly doctorId: string;
  readonly patientId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: AppointmentStatus;
  readonly reason: string;
  readonly cancelledAt: string | null;
  readonly depositAcknowledgedAt: string | null;
  readonly rescheduledFromId: string | null;
}
export interface StatusEvent {
  readonly id: string;
  readonly fromStatus: AppointmentStatus | null;
  readonly toStatus: AppointmentStatus;
  readonly occurredAt: string;
}
export interface AuditedAppointment extends Appointment {
  readonly events: readonly StatusEvent[];
}
export interface Slot {
  readonly startsAt: string;
  readonly endsAt: string;
}
export interface Page<T> {
  readonly items: readonly T[];
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
}
export interface Deposit {
  readonly required: boolean;
  readonly penaltyCount: number;
  readonly windowStartExclusive: string;
  readonly asOf: string;
  readonly reason: string;
}
export interface History extends Page<AuditedAppointment> {
  readonly patient: Patient;
  readonly deposit: Deposit;
}
export interface LocalWindow {
  readonly startMinute: number;
  readonly endMinute: number;
}
export interface WeeklyWindow extends LocalWindow {
  readonly weekday: number;
}
export interface Override {
  readonly date: string;
  readonly reason: string;
  readonly windows: readonly LocalWindow[];
}
export interface Availability {
  readonly weekly: readonly WeeklyWindow[];
  readonly overrides: readonly Override[];
}
export interface BookingInput {
  readonly doctorId: string;
  readonly startsAt: string;
  readonly reason: string;
  readonly depositAcknowledged: boolean;
}
