import { PatientDirectory } from '../domain/patient-directory';
import { AppointmentReader } from '../../appointments/domain/appointment-reader';
import { penaltyCount } from '../../appointments/domain/lifecycle-policy';
import { Clock } from '../../common/domain/clock';
import { DAY_MS } from '../../common/domain/clinic-time';
import { Pagination, requirePagination } from '../../common/domain/pagination';
import { requireId, requireInstant } from '../../common/domain/validation';

export class PatientHistory {
  constructor(
    private readonly patients: PatientDirectory,
    private readonly appointments: AppointmentReader,
    private readonly clock: Clock,
  ) {}
  async execute(id: string, input: Pagination) {
    id = requireId(id);
    const page = requirePagination(input);
    const now = requireInstant(this.clock.now());
    const patient = await this.patients.get(id);
    const from = new Date(Date.parse(now) - 30 * DAY_MS).toISOString();
    const result = await this.appointments.history(id, page, from, now);
    const count = penaltyCount(result.penalties, now);
    return {
      patient,
      items: result.items,
      total: result.total,
      ...page,
      deposit: {
        required: count >= 2,
        penaltyCount: count,
        windowStartExclusive: from,
        asOf: now,
        reason:
          count >= 2
            ? 'At least two late cancellations or no-shows in the trailing 30 days require deposit acknowledgement.'
            : 'Fewer than two recent penalties; deposit acknowledgement is not required.',
      },
    };
  }
}
