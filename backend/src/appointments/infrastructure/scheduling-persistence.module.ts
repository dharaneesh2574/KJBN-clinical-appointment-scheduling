import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { Clock } from '../../common/domain/clock';
import { SystemClock } from '../../common/infrastructure/system-clock';
import { SchedulingUnitOfWork } from '../domain/scheduling-store';
import { PrismaSchedulingUnitOfWork } from './prisma-scheduling-unit-of-work';

@Module({
  imports: [PrismaModule],
  providers: [
    { provide: Clock, useClass: SystemClock },
    {
      provide: SchedulingUnitOfWork,
      useFactory: (prisma: PrismaService) =>
        new PrismaSchedulingUnitOfWork(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [SchedulingUnitOfWork, Clock],
})
export class SchedulingPersistenceModule {}
