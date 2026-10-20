import { DoctorsController } from './api/doctors.controller';
import {
  CreateDoctor,
  GetDoctor,
  ListDoctors,
} from './application/doctor-directory';
import { DoctorDirectory } from './domain/doctor-directory';
import { PrismaDoctorDirectory } from './infrastructure/prisma-doctor-directory';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { Module } from '@nestjs/common';
import { SchedulingUnitOfWork } from '../appointments/domain/scheduling-store';
import { SchedulingPersistenceModule } from '../appointments/infrastructure/scheduling-persistence.module';
import { UpdateDoctor } from './application/update-doctor';

@Module({
  imports: [SchedulingPersistenceModule, PrismaModule],
  controllers: [DoctorsController],
  providers: [
    {
      provide: DoctorDirectory,
      useFactory: (prisma: PrismaService) => new PrismaDoctorDirectory(prisma),
      inject: [PrismaService],
    },
    ...[CreateDoctor, GetDoctor, ListDoctors].map((useCase) => ({
      provide: useCase,
      useFactory: (directory: DoctorDirectory) => new useCase(directory),
      inject: [DoctorDirectory],
    })),
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
