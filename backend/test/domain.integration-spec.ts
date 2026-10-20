import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { seedId } from '../prisma/seed-data';

const execute = promisify(execFile);
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.startsWith('/kjbn_test_')) {
  throw new Error(
    'Use TEST_DATABASE_URL pointing to an isolated kjbn_test_* database',
  );
}
const client = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function runPrisma(...args: string[]) {
  try {
    await execute(
      process.execPath,
      ['node_modules/prisma/build/index.js', ...args],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
      },
    );
  } catch {
    throw new Error(
      'Test database migration/seed command failed; check isolated database setup',
    );
  }
}

beforeAll(async () => {
  await runPrisma('migrate', 'deploy');
});
afterAll(async () => {
  await client.$disconnect();
});

describe('M1 — real PostgreSQL schema invariants', () => {
  let doctorId: string;
  let otherDoctorId: string;
  let patientId: string;
  let otherPatientId: string;

  beforeEach(async () => {
    doctorId = randomUUID();
    otherDoctorId = randomUUID();
    patientId = randomUUID();
    otherPatientId = randomUUID();
    await client.doctor.createMany({
      data: [doctorId, otherDoctorId].map((id) => ({
        id,
        name: 'Fictional test doctor',
        speciality: 'General',
        slotMinutes: 15,
        dailyCap: 2,
      })),
    });
    // Reserved fictional NANP phones separate from the seed catalog.
    await client.patient.createMany({
      data: [patientId, otherPatientId].map((id, index) => ({
        id,
        name: 'Fictional test patient',
        phone: `+12025550${String(index + 180).padStart(3, '0')}`,
        dateOfBirth: new Date('2000-01-01T00:00:00Z'),
      })),
    });
  });

  afterEach(async () => {
    // Delete only this test's random-ID fixtures, never truncate user tables.
    await client.appointmentStatusEvent.deleteMany({
      where: { appointment: { doctorId: { in: [doctorId, otherDoctorId] } } },
    });
    await client.appointment.deleteMany({
      where: { doctorId: { in: [doctorId, otherDoctorId] } },
    });
    await client.weeklyAvailability.deleteMany({
      where: { doctorId: { in: [doctorId, otherDoctorId] } },
    });
    await client.availabilityOverride.deleteMany({
      where: { doctorId: { in: [doctorId, otherDoctorId] } },
    });
    await client.doctor.deleteMany({
      where: { id: { in: [doctorId, otherDoctorId] } },
    });
    await client.patient.deleteMany({
      where: { id: { in: [patientId, otherPatientId] } },
    });
  });

  function appointment(
    overrides: Partial<Prisma.AppointmentUncheckedCreateInput> = {},
  ): Prisma.AppointmentUncheckedCreateInput {
    return {
      doctorId,
      patientId,
      startsAt: new Date('2026-10-19T03:30:00Z'),
      endsAt: new Date('2026-10-19T03:45:00Z'),
      slotMinutes: 15,
      reason: 'Fictional database test',
      ...overrides,
    };
  }

  it('rejects invalid doctor slot/cap settings and duplicate normalized phones', async () => {
    await expect(
      client.doctor.update({
        where: { id: doctorId },
        data: { slotMinutes: 20 },
      }),
    ).rejects.toThrow();
    await expect(
      client.doctor.update({ where: { id: doctorId }, data: { dailyCap: 0 } }),
    ).rejects.toThrow();
    const patient = await client.patient.findUniqueOrThrow({
      where: { id: patientId },
    });
    await expect(
      client.patient.update({
        where: { id: otherPatientId },
        data: { phone: patient.phone },
      }),
    ).rejects.toThrow();
    await expect(
      client.patient.update({
        where: { id: patientId },
        data: { phone: '202 555 0101' },
      }),
    ).rejects.toThrow();
  });

  it('rejects invalid durations and missing foreign keys', async () => {
    await expect(
      client.appointment.create({
        data: appointment({ endsAt: new Date('2026-10-19T03:40:00Z') }),
      }),
    ).rejects.toThrow();
    await expect(
      client.appointment.create({
        data: appointment({ doctorId: randomUUID() }),
      }),
    ).rejects.toThrow();
    await expect(
      client.appointment.create({ data: appointment({ status: 'CANCELLED' }) }),
    ).rejects.toThrow();
    expect(await client.appointment.count({ where: { doctorId } })).toBe(0);
  });

  it('R2: exactly one concurrent doctor-slot insert succeeds', async () => {
    const results = await Promise.allSettled([
      client.appointment.create({ data: appointment() }),
      client.appointment.create({
        data: appointment({ patientId: otherPatientId }),
      }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await client.appointment.count({ where: { doctorId } })).toBe(1);
  });

  it('R3: exactly one concurrent patient booking across doctors succeeds', async () => {
    const results = await Promise.allSettled([
      client.appointment.create({ data: appointment() }),
      client.appointment.create({
        data: appointment({ doctorId: otherDoctorId }),
      }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await client.appointment.count({ where: { patientId } })).toBe(1);
  });

  it('R2/R3: permits adjacency and frees both cancellation statuses', async () => {
    for (const status of ['CANCELLED', 'LATE_CANCELLED'] as const) {
      await client.appointment.create({
        data: appointment({
          status,
          cancelledAt: new Date(
            status === 'CANCELLED'
              ? '2026-10-18T03:30:00Z'
              : '2026-10-19T03:00:00Z',
          ),
        }),
      });
    }
    await client.appointment.create({ data: appointment() });
    await client.appointment.create({
      data: appointment({
        startsAt: new Date('2026-10-19T03:45:00Z'),
        endsAt: new Date('2026-10-19T04:00:00Z'),
      }),
    });
    expect(await client.appointment.count({ where: { doctorId } })).toBe(4);
  });

  it('supports leave and extra-day overrides; rejects overlapping/invalid windows', async () => {
    const leave = await client.availabilityOverride.create({
      data: {
        doctorId,
        date: new Date('2026-10-20T00:00:00Z'),
        reason: 'Fictional leave',
      },
      include: { windows: true },
    });
    expect(leave.windows).toEqual([]);
    const extra = await client.availabilityOverride.create({
      data: {
        doctorId,
        date: new Date('2026-10-25T00:00:00Z'),
        reason: 'Fictional Sunday',
        windows: { create: { startMinute: 600, endMinute: 720 } },
      },
    });
    await expect(
      client.availabilityWindow.create({
        data: { overrideId: extra.id, startMinute: 660, endMinute: 780 },
      }),
    ).rejects.toThrow();
    await client.weeklyAvailability.create({
      data: { doctorId, weekday: 1, startMinute: 540, endMinute: 600 },
    });
    await expect(
      client.weeklyAvailability.create({
        data: { doctorId, weekday: 1, startMinute: 570, endMinute: 630 },
      }),
    ).rejects.toThrow();
    await expect(
      client.weeklyAvailability.create({
        data: { doctorId, weekday: 8, startMinute: 540, endMinute: 600 },
      }),
    ).rejects.toThrow();
  });

  it('rolls back a failed cancel/create transaction without changing the original', async () => {
    const original = await client.appointment.create({ data: appointment() });
    await expect(
      client.$transaction(async (transaction) => {
        await transaction.appointment.update({
          where: { id: original.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date('2026-10-18T03:30:00Z'),
          },
        });
        await transaction.appointment.create({
          data: appointment({
            rescheduledFromId: original.id,
            endsAt: new Date('2026-10-19T03:40:00Z'),
          }),
        });
      }),
    ).rejects.toThrow();
    expect(
      (
        await client.appointment.findUniqueOrThrow({
          where: { id: original.id },
        })
      ).status,
    ).toBe('BOOKED');
    expect(await client.appointment.count({ where: { doctorId } })).toBe(1);
  });

  it('preserves UTC instants/date-only DOB and restricts deletion of historical parents', async () => {
    const result = await client.appointment.create({
      data: appointment({ startsAt: new Date('2026-10-19T09:00:00+05:30') }),
    });
    expect(result.startsAt.toISOString()).toBe('2026-10-19T03:30:00.000Z');
    const patient = await client.patient.findUniqueOrThrow({
      where: { id: patientId },
    });
    expect(patient.dateOfBirth.toISOString().slice(0, 10)).toBe('2000-01-01');
    await expect(
      client.doctor.delete({ where: { id: doctorId } }),
    ).rejects.toThrow();
    await expect(
      client.patient.delete({ where: { id: patientId } }),
    ).rejects.toThrow();
  });

  it('requires a booked origin for each recorded final-status event', async () => {
    const original = await client.appointment.create({ data: appointment() });
    await expect(
      client.appointmentStatusEvent.create({
        data: {
          appointmentId: original.id,
          fromStatus: null,
          toStatus: 'COMPLETED',
          occurredAt: original.endsAt,
        },
      }),
    ).rejects.toThrow();
    await client.appointmentStatusEvent.create({
      data: {
        appointmentId: original.id,
        fromStatus: null,
        toStatus: 'BOOKED',
        occurredAt: original.createdAt,
      },
    });
  });
});

describe('M1 — repeatable fictional seed', () => {
  it('preserves replacement weekly-window IDs and hours when re-seeding', async () => {
    await runPrisma('db', 'seed');
    const doctorId = seedId(1);
    await client.weeklyAvailability.deleteMany({
      where: { doctorId, weekday: 1 },
    });
    const edited = await client.weeklyAvailability.create({
      data: { doctorId, weekday: 1, startMinute: 540, endMinute: 1020 },
    });
    const count = await client.appointment.count();
    await runPrisma('db', 'seed');
    expect(
      await client.weeklyAvailability.findMany({
        where: { doctorId, weekday: 1 },
      }),
    ).toEqual([edited]);
    expect(await client.appointment.count()).toBe(count);
  });
  it('preserves closed weekdays, leave windows and removed overrides on re-seed', async () => {
    await runPrisma('db', 'seed');
    await client.weeklyAvailability.deleteMany({
      where: { doctorId: seedId(1), weekday: 2 },
    });
    await client.availabilityWindow.deleteMany({
      where: { overrideId: seedId(302) },
    });
    await client.availabilityOverride.delete({ where: { id: seedId(301) } });
    await runPrisma('db', 'seed');
    expect(
      await client.weeklyAvailability.count({
        where: { doctorId: seedId(1), weekday: 2 },
      }),
    ).toBe(0);
    expect(
      await client.availabilityWindow.count({
        where: { overrideId: seedId(302) },
      }),
    ).toBe(0);
    expect(
      await client.availabilityOverride.findUnique({
        where: { id: seedId(301) },
      }),
    ).toBeNull();
  });
  it('runs twice without duplication and preserves existing catalog edits', async () => {
    await runPrisma('db', 'seed');
    const count = await client.appointment.count();
    await client.doctor.update({
      where: { id: seedId(1) },
      data: { name: 'Edited fictional doctor' },
    });
    await runPrisma('db', 'seed');
    expect(await client.appointment.count()).toBe(count);
    expect(count).toBeGreaterThanOrEqual(9);
    expect(
      (await client.doctor.findUniqueOrThrow({ where: { id: seedId(1) } }))
        .name,
    ).toBe('Edited fictional doctor');
    expect(await client.appointment.groupBy({ by: ['status'] })).toHaveLength(
      5,
    );
    const history = await client.appointmentStatusEvent.count();
    expect(history).toBeGreaterThanOrEqual(14);
  });
});
