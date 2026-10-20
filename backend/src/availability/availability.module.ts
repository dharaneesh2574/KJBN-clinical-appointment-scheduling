import { AvailabilityController } from './api/availability.controller';
import { ReadAvailability } from './application/read-availability';
import { Clock } from '../common/domain/clock';
import { Module } from '@nestjs/common';
import { SchedulingUnitOfWork } from '../appointments/domain/scheduling-store';
import { SchedulingPersistenceModule } from '../appointments/infrastructure/scheduling-persistence.module';
import { EditSchedule } from './application/edit-schedule';

@Module({
  imports: [SchedulingPersistenceModule],
  controllers: [AvailabilityController],
  providers: [
    {
      provide: ReadAvailability,
      useFactory: (transactions: SchedulingUnitOfWork, clock: Clock) =>
        new ReadAvailability(transactions, clock),
      inject: [SchedulingUnitOfWork, Clock],
    },
    {
      provide: EditSchedule,
      useFactory: (transactions: SchedulingUnitOfWork) =>
        new EditSchedule(transactions),
      inject: [SchedulingUnitOfWork],
    },
  ],
  exports: [EditSchedule],
})
export class AvailabilityModule {}
