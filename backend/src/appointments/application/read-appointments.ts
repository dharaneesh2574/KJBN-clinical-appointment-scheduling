import { AppointmentReader } from '../domain/appointment-reader';
import { AppointmentStatus } from '../domain/appointment';
import { Clock } from '../../common/domain/clock';
import { clinicDate, dayStart, DAY_MS } from '../../common/domain/clinic-time';
import { Pagination, requirePagination } from '../../common/domain/pagination';
import {
  DomainValidationError,
  requireId,
  requireInstant,
  requireLocalDate,
} from '../../common/domain/validation';

export interface AppointmentDayQuery extends Pagination {
  readonly date?: string;
  readonly doctorId?: string;
  readonly patientId?: string;
  readonly status?: AppointmentStatus;
}
export class ReadAppointments {
  constructor(
    private readonly reader: AppointmentReader,
    private readonly clock: Clock,
  ) {}
  get(id: string) {
    return this.reader.get(requireId(id));
  }
  list(input: AppointmentDayQuery) {
    const now = requireInstant(this.clock.now());
    const date = requireLocalDate(input.date ?? clinicDate(now));
    if (
      input.status !== undefined &&
      ![
        'BOOKED',
        'COMPLETED',
        'CANCELLED',
        'LATE_CANCELLED',
        'NO_SHOW',
      ].includes(input.status)
    )
      throw new DomainValidationError('appointment status');
    return this.reader.list({
      ...requirePagination(input),
      from: new Date(dayStart(date)).toISOString(),
      to: new Date(dayStart(date) + DAY_MS).toISOString(),
      doctorId:
        input.doctorId === undefined ? undefined : requireId(input.doctorId),
      patientId:
        input.patientId === undefined ? undefined : requireId(input.patientId),
      status: input.status,
    });
  }
}
