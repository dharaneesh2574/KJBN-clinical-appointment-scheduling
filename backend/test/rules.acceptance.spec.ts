import { randomUUID } from 'node:crypto';
import {
  BookAppointment,
  BookInput,
} from '../src/appointments/application/book-appointment';
import {
  CancelAppointment,
  FinishAppointment,
} from '../src/appointments/application/change-appointment-status';
import { RescheduleAppointment } from '../src/appointments/application/reschedule-appointment';
import { ListFreeSlots } from '../src/appointments/application/list-free-slots';
import { UpdateDoctor } from '../src/doctors/application/update-doctor';
import { EditSchedule } from '../src/availability/application/edit-schedule';
import {
  Appointment,
  createAppointment,
} from '../src/appointments/domain/appointment';
import {
  assertCapacity,
  assertHorizon,
  overlaps,
} from '../src/appointments/domain/booking-policy';
import {
  penaltyCount,
  assertDeposit,
} from '../src/appointments/domain/lifecycle-policy';
import { RuleError } from '../src/common/domain/rule-error';
import { Clock, FixedClock, snapshotClock } from '../src/common/domain/clock';
import {
  clinicDate,
  DAY_MS,
  dayStart,
  isoWeekday,
} from '../src/common/domain/clinic-time';
import { requireInstant } from '../src/common/domain/validation';
import { MemoryScheduling } from './support/memory-scheduling';

const doctorId = randomUUID();
const otherDoctorId = randomUUID();
const patientId = randomUUID();
const otherPatientId = randomUUID();
const now = '2026-10-19T03:00:00.000Z'; // Monday 08:30 IST
const start = '2026-10-19T03:30:00.000Z';
let db: MemoryScheduling;
let book: BookAppointment;
let edits: EditSchedule;
const clock = new FixedClock(now);
function input(overrides: Partial<BookInput> = {}): BookInput {
  return {
    doctorId,
    patientId,
    startsAt: start,
    reason: 'Fictional acceptance test',
    depositAcknowledged: false,
    ...overrides,
  };
}
function fixture(overrides: Partial<Appointment> = {}): Appointment {
  return createAppointment({
    id: randomUUID(),
    doctorId,
    patientId,
    startsAt: start,
    endsAt: '2026-10-19T03:45:00.000Z',
    slotMinutes: 15,
    status: 'BOOKED',
    reason: 'Fictional history',
    cancelledAt: null,
    depositAcknowledgedAt: null,
    rescheduledFromId: null,
    ...overrides,
  });
}
function penalty(
  at: string,
  status: 'LATE_CANCELLED' | 'NO_SHOW' = 'LATE_CANCELLED',
): Appointment {
  return fixture({
    startsAt: at,
    endsAt: new Date(Date.parse(at) + 900000).toISOString(),
    status,
    cancelledAt: status === 'LATE_CANCELLED' ? at : null,
  });
}
function seedPenalties(count: number) {
  db.state.appointments.push(
    ...Array.from({ length: count }, (_, index) =>
      penalty(
        new Date(Date.parse(now) - (index + 1) * DAY_MS).toISOString(),
        index % 2 ? 'NO_SHOW' : 'LATE_CANCELLED',
      ),
    ),
  );
}
function assertOneWinner(
  results: readonly PromiseSettledResult<unknown>[],
  code: string,
) {
  expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  const loser = results.find((item) => item.status === 'rejected');
  expect(loser).toMatchObject({ reason: { code } });
}

beforeEach(() => {
  db = new MemoryScheduling({
    doctors: [doctorId, otherDoctorId].map((id) => ({
      id,
      name: 'Fictional doctor',
      speciality: 'General',
      slotMinutes: id === doctorId ? 15 : 30,
      dailyCap: 4,
      active: true,
    })),
    patients: [patientId, otherPatientId],
    appointments: [],
    events: [],
    overrides: [],
    weekly: [doctorId, otherDoctorId].flatMap((id) =>
      [1, 2, 3, 4, 5].map((weekday) => ({
        id: randomUUID(),
        doctorId: id,
        weekday,
        startMinute: 540,
        endMinute: 720,
      })),
    ),
  });
  book = new BookAppointment(db, clock);
  edits = new EditSchedule(db);
});

describe('R1 — effective availability and grid', () => {
  test.each([doctorId, otherDoctorId])(
    'accept exact window start/end for doctor %s',
    async (id) => {
      const minutes = id === doctorId ? 15 : 30;
      await expect(
        book.execute(input({ doctorId: id })),
      ).resolves.toMatchObject({ slotMinutes: minutes });
      const last = new Date(
        dayStart('2026-10-19') + (720 - minutes) * 60000,
      ).toISOString();
      await expect(
        book.execute(input({ doctorId: id, startsAt: last })),
      ).resolves.toMatchObject({ endsAt: '2026-10-19T06:30:00.000Z' });
    },
  );
  test('reject an appointment extending past a working window', async () => {
    await edits.replaceWeekly(doctorId, 1, [
      { startMinute: 540, endMinute: 560 },
    ]);
    await expect(
      book.execute(input({ startsAt: '2026-10-19T03:45:00Z' })),
    ).rejects.toMatchObject({ code: 'OUTSIDE_AVAILABILITY' });
  });
  test.each(['2026-10-19T03:31:00Z', '2026-10-19T03:30:00.001Z'])(
    'reject off-grid %s',
    async (startsAt) => {
      await expect(book.execute(input({ startsAt }))).rejects.toMatchObject({
        code: 'OFF_GRID',
      });
    },
  );
  test('replace weekly hours with all override windows and anchor each grid', async () => {
    await edits.putOverride({
      id: randomUUID(),
      doctorId,
      date: '2026-10-19',
      reason: 'Changed hours',
      windows: [
        { startMinute: 600, endMinute: 630 },
        { startMinute: 841, endMinute: 900 },
      ],
    });
    await expect(book.execute(input())).rejects.toMatchObject({
      code: 'OUTSIDE_AVAILABILITY',
    });
    await book.execute(input({ startsAt: '2026-10-19T04:30:00Z' }));
    await book.execute(input({ startsAt: '2026-10-19T08:31:00Z' }));
    expect(
      await new ListFreeSlots(db, clock).execute(doctorId, '2026-10-19'),
    ).toHaveLength(3);
  });
  test('return no slots on leave and allow windows on an extra working day', async () => {
    await edits.putOverride({
      id: randomUUID(),
      doctorId,
      date: '2026-10-19',
      reason: 'Leave',
      windows: [],
    });
    await expect(
      new ListFreeSlots(db, clock).execute(doctorId, '2026-10-19'),
    ).resolves.toEqual([]);
    await expect(book.execute(input())).rejects.toMatchObject({
      code: 'OUTSIDE_AVAILABILITY',
    });
    await edits.putOverride({
      id: randomUUID(),
      doctorId,
      date: '2026-10-25',
      reason: 'Extra Sunday',
      windows: [{ startMinute: 600, endMinute: 630 }],
    });
    await expect(
      book.execute(input({ startsAt: '2026-10-25T04:30:00Z' })),
    ).resolves.toMatchObject({ status: 'BOOKED' });
  });
  test('reject availability edits that invalidate an occupied appointment, listing IDs', async () => {
    const appointment = await book.execute(input());
    const before = structuredClone(db.state);
    await expect(
      edits.putOverride({
        id: randomUUID(),
        doctorId,
        date: '2026-10-19',
        reason: 'Leave',
        windows: [],
      }),
    ).rejects.toMatchObject({
      code: 'SCHEDULE_CONFLICT',
      appointmentIds: [appointment.id],
    });
    await expect(edits.replaceWeekly(doctorId, 1, [])).rejects.toMatchObject({
      code: 'SCHEDULE_CONFLICT',
    });
    expect(db.state).toEqual(before);
  });
  test('serialize availability edits racing with bookings (double contract; real DB suite also covers this)', async () => {
    const results = await Promise.allSettled([
      book.execute(input()),
      edits.putOverride({
        id: randomUUID(),
        doctorId,
        date: '2026-10-19',
        reason: 'Leave',
        windows: [],
      }),
    ]);
    assertOneWinner(results, 'SCHEDULE_CONFLICT');
  });
});

describe('R2 — doctor overlap', () => {
  test('allow adjacent half-open appointments', async () => {
    await book.execute(input());
    await expect(
      book.execute(
        input({ patientId: otherPatientId, startsAt: '2026-10-19T03:45:00Z' }),
      ),
    ).resolves.toMatchObject({ status: 'BOOKED' });
  });
  test.each([
    [-15, 15],
    [-5, 10],
    [5, 20],
    [-5, 20],
    [0, 15],
  ])('reject partial and containing overlap %s/%s', (a, b) => {
    const candidate = {
      startsAt: new Date(Date.parse(start) + a * 60000).toISOString(),
      endsAt: new Date(Date.parse(start) + b * 60000).toISOString(),
    };
    expect(overlaps(fixture(), candidate)).toBe(true);
    expect(() =>
      assertCapacity(db.state.doctors[0], candidate, [fixture()], []),
    ).toThrow(RuleError);
  });
  test('allow reuse of Cancelled and Late-Cancelled intervals', async () => {
    db.state.appointments.push(
      fixture({ status: 'CANCELLED', cancelledAt: '2026-10-18T03:30:00Z' }),
      fixture({ status: 'LATE_CANCELLED', cancelledAt: now }),
    );
    await expect(book.execute(input())).resolves.toMatchObject({
      status: 'BOOKED',
    });
  });
  test('exactly one simultaneous booking succeeds with a deliberate conflict', async () => {
    assertOneWinner(
      await Promise.allSettled([
        book.execute(input()),
        book.execute(input({ patientId: otherPatientId })),
      ]),
      'DOCTOR_OVERLAP',
    );
    expect(db.state.events).toHaveLength(1);
  });
});

describe('R3 — patient overlap', () => {
  test('reject patient overlap across different doctors', async () => {
    await book.execute(input());
    await expect(
      book.execute(input({ doctorId: otherDoctorId })),
    ).rejects.toMatchObject({ code: 'PATIENT_OVERLAP' });
  });
  test('allow adjacent bookings across different doctors', async () => {
    await book.execute(input({ doctorId: otherDoctorId }));
    await expect(
      book.execute(input({ startsAt: '2026-10-19T04:00:00Z' })),
    ).resolves.toMatchObject({ status: 'BOOKED' });
  });
  test('reject simultaneous overlapping patient bookings across doctors', async () => {
    assertOneWinner(
      await Promise.allSettled([
        book.execute(input()),
        book.execute(input({ doctorId: otherDoctorId })),
      ]),
      'PATIENT_OVERLAP',
    );
  });
});

describe('R4 — doctor daily cap', () => {
  test('allow cap minus one and last place; reject beyond cap', async () => {
    db.state.doctors[0] = { ...db.state.doctors[0], dailyCap: 2 };
    await book.execute(input());
    await book.execute(input({ startsAt: '2026-10-19T03:45:00Z' }));
    await expect(
      book.execute(input({ startsAt: '2026-10-19T04:00:00Z' })),
    ).rejects.toMatchObject({ code: 'DAILY_CAP_REACHED' });
    await expect(
      new ListFreeSlots(db, clock).execute(doctorId, '2026-10-19'),
    ).resolves.toEqual([]);
  });
  test('exclude both cancellation statuses and count Completed and No-Show', async () => {
    db.state.doctors[0] = { ...db.state.doctors[0], dailyCap: 2 };
    db.state.appointments.push(
      fixture({ status: 'COMPLETED' }),
      fixture({
        startsAt: '2026-10-19T03:45:00Z',
        endsAt: '2026-10-19T04:00:00Z',
        status: 'NO_SHOW',
      }),
    );
    await expect(
      book.execute(
        input({ startsAt: '2026-10-19T04:00:00Z', depositAcknowledged: true }),
      ),
    ).rejects.toMatchObject({ code: 'DAILY_CAP_REACHED' });
    db.state.appointments = db.state.appointments.map((item) => ({
      ...item,
      status: 'CANCELLED',
      cancelledAt: '2026-10-18T00:00:00Z',
    }));
    await expect(
      book.execute(input({ startsAt: '2026-10-19T04:00:00Z' })),
    ).resolves.toMatchObject({ status: 'BOOKED' });
  });
  test('use IST day boundaries when UTC dates differ', async () => {
    db.state.doctors[0] = { ...db.state.doctors[0], dailyCap: 1 };
    await edits.replaceWeekly(doctorId, 2, [
      { startMinute: 0, endMinute: 1440 },
    ]);
    await book.execute(input({ startsAt: '2026-10-19T18:30:00Z' })); // Tuesday 00:00
    await expect(
      book.execute(input({ startsAt: '2026-10-20T03:30:00Z' })),
    ).rejects.toMatchObject({ code: 'DAILY_CAP_REACHED' });
    await expect(book.execute(input())).resolves.toMatchObject({
      status: 'BOOKED',
    }); // Monday
  });
  test('exactly one concurrent request wins final capacity across distinct slots', async () => {
    db.state.doctors[0] = { ...db.state.doctors[0], dailyCap: 1 };
    assertOneWinner(
      await Promise.allSettled([
        book.execute(input()),
        book.execute(
          input({
            patientId: otherPatientId,
            startsAt: '2026-10-19T03:45:00Z',
          }),
        ),
      ]),
      'DAILY_CAP_REACHED',
    );
  });
});

describe('R5 — cancellation and deposit', () => {
  test.each([
    [119, 'LATE_CANCELLED'],
    [120, 'CANCELLED'],
    [121, 'CANCELLED'],
  ])(
    'classify cancellation %s minutes before start as %s',
    async (minutes, status) => {
      const appointment = await book.execute(input());
      const at = new Date(
        Date.parse(start) - Number(minutes) * 60000,
      ).toISOString();
      await expect(
        new CancelAppointment(db, new FixedClock(at)).execute(appointment.id),
      ).resolves.toMatchObject({ status, cancelledAt: at });
    },
  );
  test.each([1, 2, 3])(
    'require acknowledgement for %s penalties according to threshold',
    (count) => {
      seedPenalties(count);
      expect(penaltyCount(db.state.appointments, now)).toBe(count);
      if (count >= 2)
        expect(() => assertDeposit(db.state.appointments, now, false)).toThrow(
          RuleError,
        );
      else
        expect(() =>
          assertDeposit(db.state.appointments, now, false),
        ).not.toThrow();
      expect(() =>
        assertDeposit(db.state.appointments, now, true),
      ).not.toThrow();
    },
  );
  test('count mixed late-cancel and no-show events by the defined timestamps', () => {
    db.state.appointments.push(
      penalty('2026-10-18T03:00:00Z', 'NO_SHOW'),
      penalty('2026-10-18T04:00:00Z'),
    );
    expect(penaltyCount(db.state.appointments, now)).toBe(2);
  });
  test('exclude exact 30-day lower boundary, include now, exclude future events', () => {
    const lower = Date.parse(now) - 30 * DAY_MS;
    const history = [
      penalty(new Date(lower).toISOString()),
      penalty(new Date(lower + 1).toISOString()),
      penalty(now),
      penalty(new Date(Date.parse(now) + 1).toISOString()),
    ];
    expect(penaltyCount(history, now)).toBe(2);
  });
  test('expire penalties without a stale persisted flag', () => {
    seedPenalties(2);
    const after = new Date(Date.parse(now) + 30 * DAY_MS).toISOString();
    expect(penaltyCount(db.state.appointments, after)).toBe(0);
    expect(() =>
      assertDeposit(db.state.appointments, after, false),
    ).not.toThrow();
  });
  test('reject flagged booking without acknowledgement and accept with it', async () => {
    seedPenalties(2);
    await expect(book.execute(input())).rejects.toMatchObject({
      code: 'DEPOSIT_REQUIRED',
    });
    await expect(
      book.execute(input({ depositAcknowledged: true })),
    ).resolves.toMatchObject({ depositAcknowledgedAt: now });
  });
  test('keep repeated cancellation idempotent preserving timestamp and history', async () => {
    const appointment = await book.execute(input());
    const cancelled = await new CancelAppointment(db, clock).execute(
      appointment.id,
    );
    const state = structuredClone(db.state);
    await expect(
      new CancelAppointment(db, new FixedClock('2026-10-20T00:00:00Z')).execute(
        appointment.id,
      ),
    ).resolves.toEqual(cancelled);
    expect(db.state).toEqual(state);
  });
  test.each(['COMPLETED', 'NO_SHOW'] as const)(
    'reject final transitions and %s before end',
    async (status) => {
      const appointment = await book.execute(input());
      await expect(
        new FinishAppointment(db, clock).execute(appointment.id, status),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
      await new FinishAppointment(
        db,
        new FixedClock(appointment.endsAt),
      ).execute(appointment.id, status);
      await expect(
        new FinishAppointment(db, new FixedClock(appointment.endsAt)).execute(
          appointment.id,
          status,
        ),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
      await expect(
        new CancelAppointment(db, clock).execute(appointment.id),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    },
  );
});

describe('R6 — atomic rescheduling', () => {
  test('cancel original and book a linked replacement atomically', async () => {
    const original = await book.execute(input());
    const replacement = await new RescheduleAppointment(db, clock).execute(
      original.id,
      input({ doctorId: otherDoctorId, startsAt: '2026-10-19T04:00:00Z' }),
    );
    expect(replacement).toMatchObject({
      rescheduledFromId: original.id,
      patientId,
    });
    expect(
      db.state.appointments.find((item) => item.id === original.id),
    ).toMatchObject({ status: 'LATE_CANCELLED' });
    expect(db.state.events).toHaveLength(3);
  });
  test.each([
    '2026-10-19T03:31:00Z',
    '2026-10-19T00:00:00Z',
    '2026-10-25T04:00:00Z',
  ])(
    'invalid replacement %s preserves status, history, and capacity',
    async (startsAt) => {
      const original = await book.execute(input());
      const before = structuredClone(db.state);
      await expect(
        new RescheduleAppointment(db, clock).execute(
          original.id,
          input({ startsAt }),
        ),
      ).rejects.toThrow();
      expect(db.state).toEqual(before);
    },
  );
  test('protect both doctors and patient against concurrent reschedules', async () => {
    const original = await book.execute(input());
    const reschedule = new RescheduleAppointment(db, clock);
    assertOneWinner(
      await Promise.allSettled([
        reschedule.execute(
          original.id,
          input({ doctorId: otherDoctorId, startsAt: '2026-10-19T04:00:00Z' }),
        ),
        reschedule.execute(
          original.id,
          input({ startsAt: '2026-10-19T04:30:00Z' }),
        ),
      ]),
      'INVALID_TRANSITION',
    );
    expect(
      db.state.appointments.filter(
        (item) => item.rescheduledFromId === original.id,
      ),
    ).toHaveLength(1);
  });
  test('retain original late-cancellation penalty and require acknowledgement when threshold is reached', async () => {
    seedPenalties(1);
    const original = await book.execute(input());
    const before = structuredClone(db.state);
    const reschedule = new RescheduleAppointment(db, clock);
    await expect(
      reschedule.execute(
        original.id,
        input({ startsAt: '2026-10-19T04:00:00Z' }),
      ),
    ).rejects.toMatchObject({ code: 'DEPOSIT_REQUIRED' });
    expect(db.state).toEqual(before);
    await reschedule.execute(
      original.id,
      input({ startsAt: '2026-10-19T04:00:00Z', depositAcknowledged: true }),
    );
    expect(penaltyCount(db.state.appointments, now)).toBe(2);
  });
});

describe('R7 — booking horizon and clock', () => {
  test('reject past and accept exact now', async () => {
    const atStart = new BookAppointment(db, new FixedClock(start));
    await expect(atStart.execute(input())).resolves.toMatchObject({
      startsAt: start,
    });
    await expect(
      new BookAppointment(
        db,
        new FixedClock('2026-10-19T03:30:00.001Z'),
      ).execute(input({ startsAt: start })),
    ).rejects.toMatchObject({ code: 'BOOKING_HORIZON' });
  });
  test('accept exactly 60 elapsed days and reject one millisecond later', () => {
    const limit = Date.parse(now) + 60 * DAY_MS;
    expect(() =>
      assertHorizon(new Date(limit).toISOString(), now),
    ).not.toThrow();
    expect(() => assertHorizon(new Date(limit + 1).toISOString(), now)).toThrow(
      RuleError,
    );
  });
  test.each([
    ['2026-12-31T18:29:59.999Z', '2026-12-31', 4],
    ['2026-12-31T18:30:00Z', '2027-01-01', 5],
    ['2028-02-28T18:30:00Z', '2028-02-29', 2],
    ['2028-02-29T18:30:00Z', '2028-03-01', 3],
  ])(
    'handle IST midnight/UTC/month/year/leap boundary %s',
    (instant, date, weekday) => {
      expect(clinicDate(instant)).toBe(date);
      expect(isoWeekday(date)).toBe(weekday);
      expect(clinicDate(new Date(dayStart(date)).toISOString())).toBe(date);
      expect(() => assertHorizon(instant, instant)).not.toThrow();
    },
  );
  test('use one immutable injected snapshot per operation', async () => {
    let reads = 0;
    const changing: Clock = {
      now: () => {
        reads += 1;
        return reads === 1 ? now : '2027-01-01T00:00:00Z';
      },
    };
    const captured = snapshotClock(changing, false);
    expect(captured.now()).toBe(now);
    expect(captured.now()).toBe(now);
    expect(reads).toBe(1);
    await new BookAppointment(db, captured).execute(input());
    const original = db.state.appointments[0];
    const operationClock = { now: jest.fn(() => now) };
    await new RescheduleAppointment(db, operationClock).execute(
      original.id,
      input({ startsAt: '2026-10-19T04:00:00Z' }),
    );
    expect(operationClock.now).toHaveBeenCalledTimes(1);
    expect(db.state.events.every((event) => event.occurredAt === now)).toBe(
      true,
    );
  });
  test.each([
    '2026-10-19T03:00:00',
    '2026-02-30T00:00:00Z',
    '2026-10-19T24:00:00Z',
    '2026-10-19T03:60:00Z',
    '2026-10-19T03:00:60Z',
    '2026-10-19T03:00:00+05:60',
  ])('reject malformed clock %s', (value) => {
    expect(() => requireInstant(value)).toThrow();
    expect(() => snapshotClock(clock, true, value)).toThrow();
  });
  test('restrict reviewer overrides and isolate snapshots', () => {
    expect(() => snapshotClock(clock, false, start)).toThrow(RuleError);
    expect(snapshotClock(clock, true, start).now()).toBe(start);
    expect(snapshotClock(clock, false).now()).toBe(now);
  });
});

describe('M2 — schedule editing, free slots, and domain boundaries', () => {
  test('remove override only if weekly pattern preserves appointments', async () => {
    await edits.putOverride({
      id: randomUUID(),
      doctorId,
      date: '2026-10-25',
      reason: 'Extra Sunday',
      windows: [{ startMinute: 540, endMinute: 600 }],
    });
    await book.execute(input({ startsAt: '2026-10-25T03:30:00Z' }));
    await expect(
      edits.removeOverride(doctorId, '2026-10-25'),
    ).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' });
    await edits.putOverride({
      id: randomUUID(),
      doctorId,
      date: '2026-10-20',
      reason: 'Leave',
      windows: [],
    });
    await edits.removeOverride(doctorId, '2026-10-20');
    expect(db.state.overrides.some((item) => item.date === '2026-10-20')).toBe(
      false,
    );
  });
  test('reject incompatible doctor cap, grid and deactivation edits', async () => {
    await book.execute(input({ startsAt: '2026-10-19T03:45:00Z' }));
    await book.execute(input({ startsAt: '2026-10-19T04:00:00Z' }));
    for (const change of [
      { dailyCap: 1 },
      { slotMinutes: 30 as const },
      { active: false },
    ]) {
      await expect(
        new UpdateDoctor(db).execute({ ...db.state.doctors[0], ...change }),
      ).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' });
    }
    await new UpdateDoctor(db).execute({ ...db.state.doctors[0], dailyCap: 5 });
    expect(db.state.doctors[0].dailyCap).toBe(5);
  });
  test('preserve historical duration snapshots when new doctor slots change compatibly', async () => {
    const original = await book.execute(input());
    await new UpdateDoctor(db).execute({
      ...db.state.doctors[0],
      slotMinutes: 30,
    });
    expect(db.state.appointments[0]).toEqual(original);
    await expect(
      book.execute(input({ startsAt: '2026-10-19T04:00:00Z' })),
    ).resolves.toMatchObject({ slotMinutes: 30 });
  });
  test('validate input before persistence; reject missing resources', async () => {
    await expect(book.execute(input({ doctorId: 'bad' }))).rejects.toThrow();
  });
});

describe('M2 — revalidation and invalid input', () => {
  test('recheck an advisory slot at booking and free capacity on cancellation', async () => {
    await new UpdateDoctor(db).execute({ ...db.state.doctors[0], dailyCap: 1 });
    const slots = await new ListFreeSlots(db, clock).execute(
      doctorId,
      '2026-10-19',
    );
    const original = await book.execute(input({ startsAt: slots[0].startsAt }));
    await expect(
      book.execute(
        input({ patientId: otherPatientId, startsAt: slots[0].startsAt }),
      ),
    ).rejects.toMatchObject({ code: 'DOCTOR_OVERLAP' });
    await new CancelAppointment(db, clock).execute(original.id);
    await expect(
      book.execute(input({ patientId: otherPatientId })),
    ).resolves.toMatchObject({ status: 'BOOKED' });
  });
  test('inactive doctors expose no free slots and cannot be booked', async () => {
    await new UpdateDoctor(db).execute({
      ...db.state.doctors[0],
      active: false,
    });
    await expect(book.execute(input())).rejects.toMatchObject({
      code: 'DOCTOR_INACTIVE',
    });
    await expect(
      new ListFreeSlots(db, clock).execute(doctorId, '2026-10-19'),
    ).resolves.toEqual([]);
  });
  test('past and beyond-horizon days expose no free slots', async () => {
    await expect(
      new ListFreeSlots(db, clock).execute(doctorId, '2026-10-12'),
    ).resolves.toEqual([]);
    await expect(
      new ListFreeSlots(db, clock).execute(doctorId, '2026-12-21'),
    ).resolves.toEqual([]);
  });
  test('missing resources have stable errors from application ports', async () => {
    await expect(
      book.execute(input({ doctorId: randomUUID() })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      book.execute(input({ patientId: randomUUID() })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      new CancelAppointment(db, clock).execute(randomUUID()),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  test.each([
    'doctorId',
    'patientId',
    'startsAt',
    'reason',
    'depositAcknowledged',
  ] as const)('reject a missing %s before transaction work', async (field) => {
    const invalid = input();
    Object.defineProperty(invalid, field, { value: undefined });
    await expect(book.execute(invalid)).rejects.toMatchObject({
      code: 'INVALID_DOMAIN_VALUE',
    });
    expect(db.state.appointments).toEqual([]);
  });
  test('reject malformed availability and doctor edits through use cases', async () => {
    await expect(edits.replaceWeekly(doctorId, 8, [])).rejects.toMatchObject({
      code: 'INVALID_DOMAIN_VALUE',
    });
    await expect(
      edits.replaceWeekly(doctorId, 1, [
        { startMinute: 540, endMinute: 600 },
        { startMinute: 590, endMinute: 620 },
      ]),
    ).rejects.toMatchObject({ code: 'INVALID_DOMAIN_VALUE' });
    await expect(
      new UpdateDoctor(db).execute({
        ...db.state.doctors[0],
        dailyCap: 2147483648,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DOMAIN_VALUE' });
    const invalid = { ...db.state.doctors[0] };
    Object.defineProperty(invalid, 'active', { value: 'true' });
    await expect(new UpdateDoctor(db).execute(invalid)).rejects.toMatchObject({
      code: 'INVALID_DOMAIN_VALUE',
    });
  });
  test('late recorded no-show is attributed to start and may already have expired', async () => {
    const original = await book.execute(input());
    const after = new Date(
      Date.parse(original.startsAt) + 31 * DAY_MS,
    ).toISOString();
    await new FinishAppointment(db, new FixedClock(after)).execute(
      original.id,
      'NO_SHOW',
    );
    expect(penaltyCount(db.state.appointments, after)).toBe(0);
  });
  test('a cancelled original cannot be rescheduled and no history is appended', async () => {
    const original = await book.execute(input());
    await new CancelAppointment(db, clock).execute(original.id);
    const before = structuredClone(db.state);
    await expect(
      new RescheduleAppointment(db, clock).execute(original.id, input()),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(db.state).toEqual(before);
  });
});

test('M2 — normalize UUID case consistently across stores and use cases', async () => {
  const original = await book.execute(
    input({
      doctorId: doctorId.toUpperCase(),
      patientId: patientId.toUpperCase(),
    }),
  );
  expect(original.doctorId).toBe(doctorId);
  await new CancelAppointment(db, clock).execute(original.id.toUpperCase());
  await expect(
    new ListFreeSlots(db, clock).execute(doctorId.toUpperCase(), '2026-10-19'),
  ).resolves.toHaveLength(12);
});
