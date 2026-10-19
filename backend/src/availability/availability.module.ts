import { Module } from '@nestjs/common';
import { SchedulingUnitOfWork } from '../appointments/domain/scheduling-store';
import { SchedulingPersistenceModule } from '../appointments/infrastructure/scheduling-persistence.module';
import { EditSchedule } from './application/edit-schedule';

@Module({
  imports: [SchedulingPersistenceModule],
  providers: [
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
