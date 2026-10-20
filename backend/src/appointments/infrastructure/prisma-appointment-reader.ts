import { Prisma, PrismaClient } from '../../generated/prisma/client';
import {
  AppointmentReader,
  AppointmentFilter,
  AuditedAppointment,
} from '../domain/appointment-reader';
import { AppointmentStatusEvent } from '../domain/appointment';
import { Pagination } from '../../common/domain/pagination';
import { RuleError } from '../../common/domain/rule-error';
import { mapAppointment } from './prisma-scheduling-stores';

function mapEvent(
  item: Prisma.AppointmentStatusEventGetPayload<object>,
): AppointmentStatusEvent {
  return {
    id: item.id,
    appointmentId: item.appointmentId,
    fromStatus: item.fromStatus,
    toStatus: item.toStatus,
    occurredAt: item.occurredAt.toISOString(),
  };
}
function mapAudited(
  item: Prisma.AppointmentGetPayload<{ include: { statusEvents: true } }>,
): AuditedAppointment {
  return { ...mapAppointment(item), events: item.statusEvents.map(mapEvent) };
}
const includeEvents = {
  statusEvents: {
    orderBy: [{ occurredAt: 'asc' as const }, { id: 'asc' as const }],
  },
};
export class PrismaAppointmentReader extends AppointmentReader {
  constructor(private readonly client: PrismaClient) {
    super();
  }
  async get(id: string) {
    const record = await this.client.appointment.findUnique({
      where: { id },
      include: includeEvents,
    });
    if (!record) throw new RuleError('NOT_FOUND', 'Appointment not found');
    return mapAudited(record);
  }
  list(filter: AppointmentFilter) {
    return this.client.$transaction(
      async (tx) => {
        const where: Prisma.AppointmentWhereInput = {
          startsAt: { gte: new Date(filter.from), lt: new Date(filter.to) },
          doctorId: filter.doctorId,
          patientId: filter.patientId,
          status: filter.status,
        };
        const records = await tx.appointment.findMany({
          where,
          skip: filter.offset,
          take: filter.limit,
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        });
        return {
          items: records.map(mapAppointment),
          total: await tx.appointment.count({ where }),
          offset: filter.offset,
          limit: filter.limit,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  history(patientId: string, page: Pagination, from: string, now: string) {
    return this.client.$transaction(
      async (tx) => {
        const records = await tx.appointment.findMany({
          where: { patientId },
          skip: page.offset,
          take: page.limit,
          orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
          include: includeEvents,
        });
        const penalties = await tx.appointment.findMany({
          where: {
            patientId,
            OR: [
              {
                status: 'LATE_CANCELLED',
                cancelledAt: { gt: new Date(from), lte: new Date(now) },
              },
              {
                status: 'NO_SHOW',
                startsAt: { gt: new Date(from), lte: new Date(now) },
              },
            ],
          },
        });
        return {
          ...page,
          total: await tx.appointment.count({ where: { patientId } }),
          items: records.map(mapAudited),
          penalties: penalties.map(mapAppointment),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
