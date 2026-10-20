import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { acquireSchedulingLock } from '../src/common/infrastructure/scheduling-lock';
import { PrismaSchedulingUnitOfWork } from '../src/appointments/infrastructure/prisma-scheduling-unit-of-work';
import {
  SchedulingStores,
  SchedulingUnitOfWork,
} from '../src/appointments/domain/scheduling-store';
import {
  BookAppointment,
  BookInput,
} from '../src/appointments/application/book-appointment';
import {
  CancelAppointment,
  FinishAppointment,
} from '../src/appointments/application/change-appointment-status';
import { RescheduleAppointment } from '../src/appointments/application/reschedule-appointment';
import { UpdateDoctor } from '../src/doctors/application/update-doctor';
import { EditSchedule } from '../src/availability/application/edit-schedule';
import { ListFreeSlots } from '../src/appointments/application/list-free-slots';
import { RuleError } from '../src/common/domain/rule-error';
import { FixedClock } from '../src/common/domain/clock';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.startsWith('/kjbn_test_')) {
  throw new Error(
    'Use TEST_DATABASE_URL pointing to an isolated kjbn_test_* database',
  );
}
const client = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const transactions = new PrismaSchedulingUnitOfWork(client);
const clock = new FixedClock('2026-10-19T03:00:00Z');
const book = new BookAppointment(transactions, clock);
const edits = new EditSchedule(transactions);
let doctorId: string;
let otherDoctorId: string;
let patientId: string;
let otherPatientId: string;
const start = '2026-10-19T03:30:00.000Z';

function input(overrides: Partial<BookInput> = {}): BookInput {
  return {
    doctorId,
    patientId,
    startsAt: start,
    reason: 'Fictional M2 database test',
    depositAcknowledged: false,
    ...overrides,
  };
}
function expectRace(
  results: readonly PromiseSettledResult<unknown>[],
  code: string,
) {
  expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((item) => item.status === 'rejected')).toMatchObject({
    reason: { code },
  });
}
async function snapshot() {
  const appointments = await client.appointment.findMany({
    where: { doctorId: { in: [doctorId, otherDoctorId] } },
    orderBy: { id: 'asc' },
  });
  const events = await client.appointmentStatusEvent.findMany({
    where: { appointment: { doctorId: { in: [doctorId, otherDoctorId] } } },
    orderBy: { id: 'asc' },
  });
  return { appointments, events };
}

beforeAll(async () => {
  try {
    await promisify(execFile)(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: { ...process.env, DATABASE_URL: databaseUrl } },
    );
  } catch {
    throw new Error('Isolated M2 test database migration failed');
  }
});
afterAll(async () => {
  await client.$disconnect();
});
beforeEach(async () => {
  doctorId = randomUUID();
  otherDoctorId = randomUUID();
  patientId = randomUUID();
  otherPatientId = randomUUID();
  await client.doctor.createMany({
    data: [doctorId, otherDoctorId].map((id) => ({
      id,
      name: 'Fictional M2 doctor',
      speciality: 'General',
      slotMinutes: 15,
      dailyCap: 3,
    })),
  });
  await client.patient.createMany({
    data: [patientId, otherPatientId].map((id, index) => ({
      id,
      name: 'Fictional M2 patient',
      phone: `+1202555019${index}`,
      dateOfBirth: new Date('2000-01-01T00:00:00Z'),
    })),
  });
  for (const id of [doctorId, otherDoctorId])
    await edits.replaceWeekly(id, 1, [{ startMinute: 540, endMinute: 720 }]);
});
afterEach(async () => {
  const doctors = [doctorId, otherDoctorId];
  await client.appointmentStatusEvent.deleteMany({
    where: { appointment: { doctorId: { in: doctors } } },
  });
  // Delete successors first to honor restrictive predecessor FK.
  await client.appointment.deleteMany({
    where: { doctorId: { in: doctors }, rescheduledFromId: { not: null } },
  });
  await client.appointment.deleteMany({ where: { doctorId: { in: doctors } } });
  await client.availabilityOverride.deleteMany({
    where: { doctorId: { in: doctors } },
  });
  await client.weeklyAvailability.deleteMany({
    where: { doctorId: { in: doctors } },
  });
  await client.doctor.deleteMany({ where: { id: { in: doctors } } });
  await client.patient.deleteMany({
    where: { id: { in: [patientId, otherPatientId] } },
  });
});

describe('M2 — real PostgreSQL application transactions', () => {
  test('R2: exactly one simultaneous booking wins same doctor slot; loser has deliberate conflict', async () => {
    expectRace(
      await Promise.allSettled([
        book.execute(input()),
        book.execute(input({ patientId: otherPatientId })),
      ]),
      'DOCTOR_OVERLAP',
    );
    expect((await snapshot()).events).toHaveLength(1);
  });
  test('R3: exactly one simultaneous patient booking across doctors wins', async () => {
    expectRace(
      await Promise.allSettled([
        book.execute(input()),
        book.execute(input({ doctorId: otherDoctorId })),
      ]),
      'PATIENT_OVERLAP',
    );
  });
  test('R2/R3: adjacent slots succeed concurrently', async () => {
    const results = await Promise.all([
      book.execute(input()),
      book.execute(
        input({ startsAt: '2026-10-19T03:45:00Z', doctorId: otherDoctorId }),
      ),
    ]);
    expect(results).toHaveLength(2);
  });
  test('R4: exactly one request wins final capacity across different slots and patients', async () => {
    await new UpdateDoctor(transactions).execute({
      id: doctorId,
      name: 'Fictional cap doctor',
      speciality: 'General',
      slotMinutes: 15,
      dailyCap: 1,
      active: true,
    });
    expectRace(
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
    expect((await snapshot()).appointments).toHaveLength(1);
  });
  test.each([true, false])(
    'R1: serialize leave vs booking in both dispatch orders, booking first=%s',
    async (bookingFirst) => {
      const leave = () =>
        edits.putOverride({
          id: randomUUID(),
          doctorId,
          date: '2026-10-19',
          reason: 'Fictional leave',
          windows: [],
        });
      const booking = () => book.execute(input());
      const results = await Promise.allSettled(
        bookingFirst ? [booking(), leave()] : [leave(), booking()],
      );
      expect(
        results.filter((item) => item.status === 'fulfilled'),
      ).toHaveLength(1);
      const loser = results.find((item) => item.status === 'rejected');
      expect(
        loser?.status === 'rejected' && loser.reason instanceof Error,
      ).toBe(true);
      const reason: unknown =
        loser?.status === 'rejected' ? loser.reason : undefined;
      if (!(reason instanceof RuleError))
        throw new Error('Expected a scheduling conflict');
      expect(['SCHEDULE_CONFLICT', 'OUTSIDE_AVAILABILITY']).toContain(
        reason.code,
      );
      const saved = await client.appointment.count({ where: { doctorId } });
      const override = await client.availabilityOverride.count({
        where: { doctorId },
      });
      expect(saved + override).toBe(1);
    },
  );
  test('R1: reject weekly grid edits and report affected IDs, retaining availability', async () => {
    const appointment = await book.execute(input());
    await expect(
      edits.replaceWeekly(doctorId, 1, [{ startMinute: 541, endMinute: 720 }]),
    ).rejects.toMatchObject({
      code: 'SCHEDULE_CONFLICT',
      appointmentIds: [appointment.id],
    });
    expect(
      (
        await client.weeklyAvailability.findFirstOrThrow({
          where: { doctorId },
        })
      ).startMinute,
    ).toBe(540);
  });
  test('R4: a doctor cap edit racing a booking cannot overfill the new cap', async () => {
    await book.execute(input());
    const results = await Promise.allSettled([
      book.execute(
        input({ startsAt: '2026-10-19T03:45:00Z', patientId: otherPatientId }),
      ),
      new UpdateDoctor(transactions).execute({
        id: doctorId,
        name: 'Fictional cap doctor',
        speciality: 'General',
        slotMinutes: 15,
        dailyCap: 1,
        active: true,
      }),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    const doctor = await client.doctor.findUniqueOrThrow({
      where: { id: doctorId },
    });
    expect(
      await client.appointment.count({ where: { doctorId } }),
    ).toBeLessThanOrEqual(doctor.dailyCap);
  });
  test('R6: invalid replacement preserves original row, updatedAt, history and capacity', async () => {
    const original = await book.execute(input());
    const before = await snapshot();
    await expect(
      new RescheduleAppointment(transactions, clock).execute(
        original.id,
        input({ startsAt: '2026-10-19T03:31:00Z' }),
      ),
    ).rejects.toMatchObject({ code: 'OFF_GRID' });
    expect(await snapshot()).toEqual(before);
    await expect(
      book.execute(input({ patientId: otherPatientId })),
    ).rejects.toMatchObject({ code: 'DOCTOR_OVERLAP' });
  });
  test('R6: rollback even after replacement insert/history succeeded and a later write fails', async () => {
    const original = await book.execute(input());
    const before = await snapshot();
    class FailingTransaction extends SchedulingUnitOfWork {
      run<T>(work: (stores: SchedulingStores) => Promise<T>): Promise<T> {
        return transactions.run((stores) =>
          work({
            ...stores,
            booking: {
              ...stores.booking,
              async insertAppointment(input, now) {
                await stores.booking.insertAppointment(input, now);
                throw new Error('Injected failure after insert');
              },
            },
          }),
        );
      }
    }
    await expect(
      new RescheduleAppointment(new FailingTransaction(), clock).execute(
        original.id,
        input({ startsAt: '2026-10-19T04:00:00Z' }),
      ),
    ).rejects.toThrow('Injected failure after insert');
    expect(await snapshot()).toEqual(before);
  });
  test('R6: valid cross-doctor reschedule writes linked rows and all three events', async () => {
    const original = await book.execute(input());
    const replacement = await new RescheduleAppointment(
      transactions,
      clock,
    ).execute(
      original.id,
      input({ doctorId: otherDoctorId, startsAt: '2026-10-19T04:00:00Z' }),
    );
    expect(replacement).toMatchObject({
      rescheduledFromId: original.id,
      status: 'BOOKED',
    });
    expect(
      (
        await client.appointment.findUniqueOrThrow({
          where: { id: original.id },
        })
      ).status,
    ).toBe('LATE_CANCELLED');
    const saved = await snapshot();
    expect(saved.events).toHaveLength(3);
    expect(
      saved.events.every(
        (item) => item.occurredAt.toISOString() === clock.now(),
      ),
    ).toBe(true);
  });
  test('R6: two concurrent cross-doctor reschedules create exactly one successor', async () => {
    const original = await book.execute(input());
    const reschedule = new RescheduleAppointment(transactions, clock);
    expectRace(
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
      await client.appointment.count({
        where: { rescheduledFromId: original.id },
      }),
    ).toBe(1);
  });
  test('R6/R3: rescheduling racing an overlapping cross-doctor patient booking has one winner', async () => {
    const original = await book.execute(input());
    expectRace(
      await Promise.allSettled([
        new RescheduleAppointment(transactions, clock).execute(
          original.id,
          input({ startsAt: '2026-10-19T04:00:00Z' }),
        ),
        book.execute(
          input({ doctorId: otherDoctorId, startsAt: '2026-10-19T04:00:00Z' }),
        ),
      ]),
      'PATIENT_OVERLAP',
    );
  });
  test('R5: concurrent repeated cancellation preserves one event and original timestamp', async () => {
    const original = await book.execute(input());
    const cancel = new CancelAppointment(transactions, clock);
    const results = await Promise.all([
      cancel.execute(original.id),
      cancel.execute(original.id),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect((await snapshot()).events).toHaveLength(2);
    await expect(book.execute(input())).resolves.toMatchObject({
      status: 'BOOKED',
    });
  });
  test('R5: status history, derived penalty and deposit acknowledgement survive persistence', async () => {
    const original = await book.execute(input());
    await new CancelAppointment(transactions, clock).execute(original.id);
    const second = await book.execute(
      input({ startsAt: '2026-10-19T03:45:00Z' }),
    );
    await new CancelAppointment(transactions, clock).execute(second.id);
    await expect(
      book.execute(input({ startsAt: '2026-10-19T04:00:00Z' })),
    ).rejects.toMatchObject({ code: 'DEPOSIT_REQUIRED' });
    await expect(
      book.execute(
        input({ startsAt: '2026-10-19T04:00:00Z', depositAcknowledged: true }),
      ),
    ).resolves.toMatchObject({ depositAcknowledgedAt: clock.now() });
    expect((await snapshot()).events).toHaveLength(5);
  });
  test('R5: no-show vs completion race changes status once with one final event', async () => {
    const original = await book.execute(input());
    const finish = new FinishAppointment(
      transactions,
      new FixedClock(original.endsAt),
    );
    expectRace(
      await Promise.allSettled([
        finish.execute(original.id, 'NO_SHOW'),
        finish.execute(original.id, 'COMPLETED'),
      ]),
      'INVALID_TRANSITION',
    );
    expect((await snapshot()).events).toHaveLength(2);
  });
  test('R1: extra-day override removal rejects if it would invalidate a booking', async () => {
    await edits.putOverride({
      id: randomUUID(),
      doctorId,
      date: '2026-10-25',
      reason: 'Fictional extra day',
      windows: [{ startMinute: 540, endMinute: 600 }],
    });
    await book.execute(input({ startsAt: '2026-10-25T03:30:00Z' }));
    await expect(
      edits.removeOverride(doctorId, '2026-10-25'),
    ).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' });
    expect(
      await new ListFreeSlots(transactions, clock).execute(
        doctorId,
        '2026-10-25',
      ),
    ).toHaveLength(3);
  });
  test('M2: missing resources give stable errors rather than exposing Prisma failures', async () => {
    await expect(
      book.execute(input({ patientId: randomUUID() })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      book.execute(input({ doctorId: randomUUID() })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      new CancelAppointment(transactions, clock).execute(randomUUID()),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await snapshot()).appointments).toHaveLength(0);
  });
});

describe('M2 — lock bounds and override persistence', () => {
  test('return a deliberate busy conflict after bounded lock waiting and allow retry', async () => {
    let acquired = () => {};
    const acquiredPromise = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    let release = () => {};
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const holder = client.$transaction(
      async (tx) => {
        await acquireSchedulingLock(tx);
        acquired();
        await releasePromise;
      },
      { timeout: 15000 },
    );
    // If acquisition fails, propagate it instead of waiting forever on a signal.
    await Promise.race([acquiredPromise, holder]);
    try {
      await expect(book.execute(input())).rejects.toMatchObject({
        code: 'CONCURRENT_MODIFICATION',
      });
      expect((await snapshot()).appointments).toHaveLength(0);
    } finally {
      release();
      await holder;
    }
    await expect(book.execute(input())).resolves.toMatchObject({
      status: 'BOOKED',
    });
  });
  test('replace all override windows, retain identity, and safely restore weekly availability', async () => {
    const id = randomUUID();
    await edits.putOverride({
      id,
      doctorId,
      date: '2026-10-19',
      reason: 'First hours',
      windows: [{ startMinute: 600, endMinute: 660 }],
    });
    await edits.putOverride({
      id: randomUUID(),
      doctorId,
      date: '2026-10-19',
      reason: 'Changed hours',
      windows: [
        { startMinute: 540, endMinute: 570 },
        { startMinute: 840, endMinute: 870 },
      ],
    });
    const saved = await client.availabilityOverride.findUniqueOrThrow({
      where: { id },
      include: { windows: true },
    });
    expect(saved.windows).toHaveLength(2);
    expect(saved.reason).toBe('Changed hours');
    await edits.removeOverride(doctorId, '2026-10-19');
    expect(
      await client.availabilityWindow.count({ where: { overrideId: id } }),
    ).toBe(0);
    await expect(book.execute(input())).resolves.toMatchObject({
      status: 'BOOKED',
    });
  });
});
