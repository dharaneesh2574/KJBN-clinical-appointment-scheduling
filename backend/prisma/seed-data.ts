import { AppointmentStatus, PatientFlag } from '../src/generated/prisma/client';

export const SEED_REFERENCE_INSTANT = '2026-10-19T03:00:00.000Z';
export const seedId = (value: number): string =>
  `10000000-0000-4000-8000-${String(value).padStart(12, '0')}`;

export const doctors = [
  {
    id: seedId(1),
    name: 'Dr Asha Demo',
    speciality: 'Cardiology',
    slotMinutes: 15,
    dailyCap: 12,
  },
  {
    id: seedId(2),
    name: 'Dr Ravi Demo',
    speciality: 'General medicine',
    slotMinutes: 30,
    dailyCap: 8,
  },
];

export const patients = [
  {
    id: seedId(11),
    name: 'Fictional Patient One',
    phone: '+12025550101',
    dateOfBirth: new Date('1990-03-12T00:00:00Z'),
    flags: [],
  },
  {
    id: seedId(12),
    name: 'Fictional Patient Two',
    phone: '+12025550102',
    dateOfBirth: new Date('1985-07-21T00:00:00Z'),
    flags: [PatientFlag.MOBILITY_ASSISTANCE],
  },
  {
    id: seedId(13),
    name: 'Fictional Patient Three',
    phone: '+12025550103',
    dateOfBirth: new Date('2000-02-29T00:00:00Z'),
    flags: [],
  },
  {
    id: seedId(14),
    name: 'Fictional Patient Four',
    phone: '+12025550104',
    dateOfBirth: new Date('1972-11-02T00:00:00Z'),
    flags: [PatientFlag.INTERPRETER_REQUIRED],
  },
];

interface AppointmentFixture {
  readonly number: number;
  readonly doctor: number;
  readonly patient: number;
  readonly start: string;
  readonly minutes: 15 | 30;
  readonly status: AppointmentStatus;
  readonly cancelledAt?: string;
  readonly depositAcknowledgedAt?: string;
  readonly rescheduledFrom?: number;
}

const fixtures: readonly AppointmentFixture[] = [
  {
    number: 501,
    doctor: 1,
    patient: 11,
    start: '2026-10-16T09:00:00+05:30',
    minutes: 15,
    status: 'COMPLETED',
  },
  {
    number: 502,
    doctor: 2,
    patient: 12,
    start: '2026-10-15T09:00:00+05:30',
    minutes: 30,
    status: 'NO_SHOW',
  },
  {
    number: 503,
    doctor: 1,
    patient: 13,
    start: '2026-10-16T10:00:00+05:30',
    minutes: 15,
    status: 'LATE_CANCELLED',
    cancelledAt: '2026-10-16T09:01:00+05:30',
  },
  {
    number: 504,
    doctor: 2,
    patient: 13,
    start: '2026-10-15T10:00:00+05:30',
    minutes: 30,
    status: 'NO_SHOW',
  },
  {
    number: 505,
    doctor: 1,
    patient: 14,
    start: '2026-10-16T11:00:00+05:30',
    minutes: 15,
    status: 'CANCELLED',
    cancelledAt: '2026-10-16T08:00:00+05:30',
  },
  {
    number: 506,
    doctor: 1,
    patient: 11,
    start: '2026-10-19T09:00:00+05:30',
    minutes: 15,
    status: 'BOOKED',
  },
  {
    number: 507,
    doctor: 1,
    patient: 13,
    start: '2026-10-19T09:15:00+05:30',
    minutes: 15,
    status: 'BOOKED',
    depositAcknowledgedAt: '2026-10-19T08:00:00+05:30',
  },
  {
    number: 508,
    doctor: 2,
    patient: 12,
    start: '2026-10-19T09:30:00+05:30',
    minutes: 30,
    status: 'BOOKED',
  },
  {
    number: 509,
    doctor: 2,
    patient: 14,
    start: '2026-10-19T10:00:00+05:30',
    minutes: 30,
    status: 'BOOKED',
    rescheduledFrom: 505,
  },
];

export const appointments = fixtures.map((fixture) => ({
  id: seedId(fixture.number),
  doctorId: seedId(fixture.doctor),
  patientId: seedId(fixture.patient),
  startsAt: new Date(fixture.start),
  endsAt: new Date(Date.parse(fixture.start) + fixture.minutes * 60000),
  slotMinutes: fixture.minutes,
  status: fixture.status,
  reason: 'Fictional demonstration consultation',
  cancelledAt: fixture.cancelledAt ? new Date(fixture.cancelledAt) : null,
  depositAcknowledgedAt: fixture.depositAcknowledgedAt
    ? new Date(fixture.depositAcknowledgedAt)
    : null,
  rescheduledFromId: fixture.rescheduledFrom
    ? seedId(fixture.rescheduledFrom)
    : null,
  createdAt: fixture.rescheduledFrom
    ? new Date('2026-10-16T08:00:00+05:30')
    : new Date(Date.parse(fixture.start) - 7 * 86400000),
}));
