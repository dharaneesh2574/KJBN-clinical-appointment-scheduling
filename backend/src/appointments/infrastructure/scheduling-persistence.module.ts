import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { SchedulingUnitOfWork } from '../domain/scheduling-store';
import { PrismaSchedulingUnitOfWork } from './prisma-scheduling-unit-of-work';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: SchedulingUnitOfWork,
      useFactory: (prisma: PrismaService) =>
        new PrismaSchedulingUnitOfWork(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [SchedulingUnitOfWork],
})
export class SchedulingPersistenceModule {}
