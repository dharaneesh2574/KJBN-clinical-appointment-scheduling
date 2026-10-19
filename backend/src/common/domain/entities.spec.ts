import { createDoctor } from '../../doctors/domain/doctor';
import { createPatient, normalizePhone } from '../../patients/domain/patient';
import {
  createDateOverride,
  createWeeklyAvailability,
  validateWindows,
} from '../../availability/domain/availability';
import { createAppointment } from '../../appointments/domain/appointment';
import { requireInstant, requireLocalDate } from './validation';

const id = '20000000-0000-4000-8000-000000000001';

describe('M1 domain invariants', () => {
  it.each([15, 30])(
    'accepts a %i-minute doctor and a positive cap',
    (slotMinutes) => {
      expect(
        createDoctor({
          id,
          name: ' Demo ',
          speciality: 'General',
          slotMinutes,
          dailyCap: 8,
          active: true,
        }).name,
      ).toBe('Demo');
    },
  );
  it.each([
    { slotMinutes: 20, dailyCap: 8 },
    { slotMinutes: 15, dailyCap: 0 },
  ])('rejects invalid doctor settings', (settings) => {
    expect(() =>
      createDoctor({
        id,
        name: 'Demo',
        speciality: 'General',
        active: true,
        ...settings,
      }),
    ).toThrow();
  });
  it('normalizes phones without guessing a country and validates real DOBs', () => {
    expect(normalizePhone('+1 (202) 555-0101')).toBe('+12025550101');
    expect(() => normalizePhone('2025550101')).toThrow();
    const patient = {
      id,
      name: 'Fictional',
      phone: '+12025550101',
      dateOfBirth: '2000-02-29',
      flags: [],
    };
    expect(createPatient(patient, '2026-10-19').dateOfBirth).toBe('2000-02-29');
    expect(() =>
      createPatient({ ...patient, dateOfBirth: '2027-01-01' }, '2026-10-19'),
    ).toThrow();
    expect(() => requireLocalDate('2025-02-29')).toThrow();
  });
  it('allows adjacent local windows, empty leave overrides, and extra-day overrides', () => {
    expect(
      validateWindows([
        { startMinute: 540, endMinute: 600 },
        { startMinute: 600, endMinute: 660 },
      ]),
    ).toHaveLength(2);
    expect(
      createDateOverride({
        id,
        doctorId: id,
        date: '2026-10-20',
        reason: 'Leave',
        windows: [],
      }).windows,
    ).toEqual([]);
    expect(
      createDateOverride({
        id,
        doctorId: id,
        date: '2026-10-25',
        reason: 'Extra Sunday',
        windows: [{ startMinute: 600, endMinute: 720 }],
      }).windows,
    ).toHaveLength(1);
    expect(() =>
      createWeeklyAvailability({
        id,
        doctorId: id,
        weekday: 0,
        startMinute: 540,
        endMinute: 600,
      }),
    ).toThrow();
  });
  it.each([
    [{ startMinute: 600, endMinute: 540 }],
    [{ startMinute: -1, endMinute: 60 }],
    [{ startMinute: 600, endMinute: 1441 }],
    [
      { startMinute: 540, endMinute: 610 },
      { startMinute: 600, endMinute: 660 },
    ],
  ])('rejects invalid/overlapping availability', (...windows) => {
    expect(() => validateWindows(windows)).toThrow();
  });
  it('normalizes UTC instants and preserves the slot snapshot', () => {
    const appointment = {
      id,
      doctorId: id,
      patientId: id,
      startsAt: '2026-10-19T09:00:00+05:30',
      endsAt: '2026-10-19T09:15:00+05:30',
      slotMinutes: 15 as const,
      status: 'BOOKED' as const,
      reason: 'Demo consultation',
      cancelledAt: null,
      depositAcknowledgedAt: null,
      rescheduledFromId: null,
    };
    expect(createAppointment(appointment).startsAt).toBe(
      '2026-10-19T03:30:00.000Z',
    );
    expect(() =>
      createAppointment({
        ...appointment,
        endsAt: '2026-10-19T09:30:00+05:30',
      }),
    ).toThrow();
    expect(() =>
      createAppointment({ ...appointment, status: 'CANCELLED' }),
    ).toThrow();
    expect(() => requireInstant('2026-10-19T09:00:00')).toThrow();
    expect(() => requireInstant('2026-02-30T09:00:00Z')).toThrow();
  });
});
