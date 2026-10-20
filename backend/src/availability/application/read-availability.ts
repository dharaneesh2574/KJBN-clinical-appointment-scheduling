import { SchedulingUnitOfWork } from '../../appointments/domain/scheduling-store';
import { Clock } from '../../common/domain/clock';
import { clinicDate, DAY_MS, dayStart } from '../../common/domain/clinic-time';
import {
  requireId,
  requireInstant,
  requireLocalDate,
  DomainValidationError,
} from '../../common/domain/validation';
export class ReadAvailability {
  constructor(
    private readonly transactions: SchedulingUnitOfWork,
    private readonly clock: Clock,
  ) {}
  execute(id: string, from?: string, to?: string) {
    id = requireId(id);
    const now = requireInstant(this.clock.now());
    const first = requireLocalDate(from ?? clinicDate(now));
    const last = requireLocalDate(
      to ?? clinicDate(new Date(dayStart(first) + 60 * DAY_MS).toISOString()),
    );
    if (last < first || dayStart(last) - dayStart(first) > 366 * DAY_MS)
      throw new DomainValidationError('availability date range');
    return this.transactions.run(async ({ schedules }) => {
      await schedules.doctor(id);
      const schedule = await schedules.schedule(id);
      return {
        doctorId: id,
        from: first,
        to: last,
        weekly: schedule.weekly,
        overrides: schedule.overrides.filter(
          (item) => item.date >= first && item.date <= last,
        ),
      };
    });
  }
}
