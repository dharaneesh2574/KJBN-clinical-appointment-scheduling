import { Module } from '@nestjs/common';
import { Clock } from '../common/domain/clock';
import { SchedulingUnitOfWork } from './domain/scheduling-store';
import { SchedulingPersistenceModule } from './infrastructure/scheduling-persistence.module';
import { BookAppointment } from './application/book-appointment';
import {
  CancelAppointment,
  FinishAppointment,
} from './application/change-appointment-status';
import { RescheduleAppointment } from './application/reschedule-appointment';
import { ListFreeSlots } from './application/list-free-slots';

const useCases = [
  BookAppointment,
  CancelAppointment,
  FinishAppointment,
  RescheduleAppointment,
  ListFreeSlots,
];

@Module({
  imports: [SchedulingPersistenceModule],
  providers: useCases.map((useCase) => ({
    provide: useCase,
    useFactory: (transactions: SchedulingUnitOfWork, clock: Clock) =>
      new useCase(transactions, clock),
    inject: [SchedulingUnitOfWork, Clock],
  })),
  exports: useCases,
})
export class AppointmentsModule {}
