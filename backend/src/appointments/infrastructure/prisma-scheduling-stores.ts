import { Prisma } from '../../generated/prisma/client';
import { Appointment, createAppointment } from '../domain/appointment';
import { SchedulingStores, ScheduleReader } from '../domain/scheduling-store';
import { createDoctor } from '../../doctors/domain/doctor';
import { requireSlotMinutes } from '../../common/domain/validation';
import { RuleError } from '../../common/domain/rule-error';

function mapAppointment(
  record: Prisma.AppointmentGetPayload<object>,
): Appointment {
  return createAppointment({
    id: record.id,
    doctorId: record.doctorId,
    patientId: record.patientId,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    slotMinutes: requireSlotMinutes(record.slotMinutes),
    status: record.status,
    reason: record.reason,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    depositAcknowledgedAt: record.depositAcknowledgedAt?.toISOString() ?? null,
    rescheduledFromId: record.rescheduledFromId,
  });
}

function missing(resource: string): never {
  throw new RuleError('NOT_FOUND', `${resource} not found`);
}

export function prismaSchedulingStores(
  tx: Prisma.TransactionClient,
): SchedulingStores {
  const reader: ScheduleReader = {
    async doctor(id) {
      const record = await tx.doctor.findUnique({ where: { id } });
      if (!record) return missing('Doctor');
      return createDoctor(record);
    },
    async schedule(doctorId) {
      const weekly = await tx.weeklyAvailability.findMany({
        where: { doctorId },
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      });
      const overrides = await tx.availabilityOverride.findMany({
        where: { doctorId },
        include: { windows: { orderBy: { startMinute: 'asc' } } },
        orderBy: { date: 'asc' },
      });
      return {
        weekly: weekly.map(
          ({ id, doctorId, weekday, startMinute, endMinute }) => ({
            id,
            doctorId,
            weekday,
            startMinute,
            endMinute,
          }),
        ),
        overrides: overrides.map((item) => ({
          id: item.id,
          doctorId: item.doctorId,
          date: item.date.toISOString().slice(0, 10),
          reason: item.reason,
          windows: item.windows.map(({ startMinute, endMinute }) => ({
            startMinute,
            endMinute,
          })),
        })),
      };
    },
    async doctorAppointments(doctorId) {
      return (
        await tx.appointment.findMany({
          where: { doctorId },
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        })
      ).map(mapAppointment);
    },
  };
  return {
    booking: {
      ...reader,
      async patientExists(id) {
        if (
          !(await tx.patient.findUnique({
            where: { id },
            select: { id: true },
          }))
        )
          missing('Patient');
      },
      async appointment(id) {
        const record = await tx.appointment.findUnique({ where: { id } });
        return record ? mapAppointment(record) : missing('Appointment');
      },
      async patientHistory(patientId) {
        return (
          await tx.appointment.findMany({
            where: { patientId },
            orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          })
        ).map(mapAppointment);
      },
      async insertAppointment(input, now) {
        const record = await tx.appointment.create({
          data: {
            ...input,
            statusEvents: {
              create: {
                fromStatus: null,
                toStatus: 'BOOKED',
                occurredAt: new Date(now),
              },
            },
          },
        });
        return mapAppointment(record);
      },
      async updateAppointment(input, now) {
        const record = await tx.appointment.update({
          where: { id: input.id },
          data: {
            status: input.status,
            cancelledAt: input.cancelledAt,
            statusEvents: {
              create: {
                fromStatus: 'BOOKED',
                toStatus: input.status,
                occurredAt: new Date(now),
              },
            },
          },
        });
        return mapAppointment(record);
      },
    },
    schedules: {
      ...reader,
      async replaceWeekly(doctorId, weekday, windows) {
        await tx.weeklyAvailability.deleteMany({
          where: { doctorId, weekday },
        });
        await tx.weeklyAvailability.createMany({
          data: windows.map((window) => ({ doctorId, weekday, ...window })),
        });
      },
      async putOverride(input) {
        const record = await tx.availabilityOverride.upsert({
          where: {
            doctorId_date: {
              doctorId: input.doctorId,
              date: new Date(`${input.date}T00:00:00Z`),
            },
          },
          create: {
            id: input.id,
            doctorId: input.doctorId,
            date: new Date(`${input.date}T00:00:00Z`),
            reason: input.reason,
          },
          update: { reason: input.reason },
        });
        await tx.availabilityWindow.deleteMany({
          where: { overrideId: record.id },
        });
        await tx.availabilityWindow.createMany({
          data: input.windows.map((window) => ({
            overrideId: record.id,
            ...window,
          })),
        });
      },
      async removeOverride(doctorId, date) {
        await tx.availabilityOverride.deleteMany({
          where: { doctorId, date: new Date(`${date}T00:00:00Z`) },
        });
      },
      async updateDoctor(doctor) {
        await tx.doctor.update({ where: { id: doctor.id }, data: doctor });
      },
    },
  };
}
