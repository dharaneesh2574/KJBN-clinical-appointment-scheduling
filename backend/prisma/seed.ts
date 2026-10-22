import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { acquireSchedulingLock } from '../src/common/infrastructure/scheduling-lock';
import { prismaSchedulingStores } from '../src/appointments/infrastructure/prisma-scheduling-stores';
import { assertScheduleEdit } from '../src/availability/domain/schedule-edit-policy';
import { AppConfig } from '../src/common/config/app-config';
import {
  appointments,
  doctors,
  patients,
  SEED_REFERENCE_INSTANT,
  seedId,
} from './seed-data';

async function seed() {
  const config = AppConfig.fromEnvironment(process.env);
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  });
  try {
    await client.$transaction(
      async (transaction) => {
        await acquireSchedulingLock(transaction);
        const newDoctorIds = new Set<string>();
        for (const doctor of doctors) {
          const existing = await transaction.doctor.findUnique({
            where: { id: doctor.id },
            select: { id: true },
          });
          if (!existing) newDoctorIds.add(doctor.id);
          await transaction.doctor.upsert({
            where: { id: doctor.id },
            create: doctor,
            update: {},
          });
        }
        for (const patient of patients) {
          await transaction.patient.upsert({
            where: { id: patient.id },
            create: patient,
            update: {},
          });
        }
        // Availability is initialized only for newly created seed doctors.
        // A replaced window has a new ID; an empty day/removed override can be
        // intentional. Reconstructing either on rerun would undo clinic edits.
        for (let doctor = 1; doctor <= 2; doctor += 1) {
          if (!newDoctorIds.has(seedId(doctor))) continue;
          for (let weekday = 1; weekday <= 5; weekday += 1) {
            for (const [index, window] of [
              { startMinute: 540, endMinute: 720 },
              { startMinute: 840, endMinute: 1020 },
            ].entries()) {
              const id = seedId(100 + doctor * 20 + weekday * 2 + index);
              await transaction.weeklyAvailability.upsert({
                where: { id },
                create: { id, doctorId: seedId(doctor), weekday, ...window },
                update: {},
              });
            }
          }
        }
        if (newDoctorIds.has(seedId(1))) {
          await transaction.availabilityOverride.upsert({
            where: { id: seedId(301) },
            create: {
              id: seedId(301),
              doctorId: seedId(1),
              date: new Date('2026-10-20T00:00:00Z'),
              reason: 'Annual leave',
            },
            update: {},
          });
        }
        if (newDoctorIds.has(seedId(2))) {
          await transaction.availabilityOverride.upsert({
            where: { id: seedId(302) },
            create: {
              id: seedId(302),
              doctorId: seedId(2),
              date: new Date('2026-10-25T00:00:00Z'),
              reason: 'Additional Sunday clinic',
            },
            update: {},
          });
          await transaction.availabilityWindow.upsert({
            where: { id: seedId(303) },
            create: {
              id: seedId(303),
              overrideId: seedId(302),
              startMinute: 600,
              endMinute: 720,
            },
            update: {},
          });
        }
        for (const appointment of appointments) {
          // Events are created with the new appointment only: reruns never rewrite
          // user-edited appointments or invent events for pre-existing records.
          const events = [
            {
              id: seedId(Number(appointment.id.slice(-12)) + 1000),
              fromStatus: null,
              toStatus: 'BOOKED' as const,
              occurredAt: appointment.createdAt,
            },
          ];
          await transaction.appointment.upsert({
            where: { id: appointment.id },
            update: {},
            create: {
              ...appointment,
              statusEvents: {
                create: [
                  ...events,
                  ...(appointment.status === 'BOOKED'
                    ? []
                    : [
                        {
                          id: seedId(Number(appointment.id.slice(-12)) + 2000),
                          fromStatus: 'BOOKED' as const,
                          toStatus: appointment.status,
                          occurredAt:
                            appointment.cancelledAt ?? appointment.endsAt,
                        },
                      ]),
                ],
              },
            },
          });
        }
        // Seed imports historical rows, so it intentionally bypasses booking's
        // horizon/lifecycle checks, while preserving cap/availability invariants.
        const { schedules } = prismaSchedulingStores(transaction);
        for (const doctor of doctors) {
          assertScheduleEdit(
            await schedules.doctor(doctor.id),
            await schedules.schedule(doctor.id),
            await schedules.doctorAppointments(doctor.id),
          );
        }
      },
      { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 30000 },
    );
    console.log(
      `Clinic catalog ensured; reviewer reference: ${SEED_REFERENCE_INSTANT}`,
    );
  } finally {
    await client.$disconnect();
  }
}

void seed().catch(() => {
  // Prisma errors can contain record/connection details; never print them here.
  console.error(
    'Seed failed. Verify database connectivity, migrations, and catalog conflicts.',
  );
  process.exitCode = 1;
});
