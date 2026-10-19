import { Module } from '@nestjs/common';
import { SchedulingUnitOfWork } from '../appointments/domain/scheduling-store';
import { SchedulingPersistenceModule } from '../appointments/infrastructure/scheduling-persistence.module';
import { UpdateDoctor } from './application/update-doctor';

@Module({
  imports: [SchedulingPersistenceModule],
  providers: [
    {
      provide: UpdateDoctor,
      useFactory: (transactions: SchedulingUnitOfWork) =>
        new UpdateDoctor(transactions),
      inject: [SchedulingUnitOfWork],
    },
  ],
  exports: [UpdateDoctor],
})
export class DoctorsModule {}
