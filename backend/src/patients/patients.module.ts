import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../common/domain/clock';
import { PatientDirectory } from './domain/patient-directory';
import { PrismaPatientDirectory } from './infrastructure/prisma-patient-directory';
import {
  CreatePatient,
  GetPatient,
  UpdatePatient,
} from './application/patient-directory';
import { PatientHistory } from './application/patient-history';
import { AppointmentReader } from '../appointments/domain/appointment-reader';
import { AppointmentQueriesModule } from '../appointments/infrastructure/appointment-queries.module';
import { PatientsController } from './api/patients.controller';

@Module({
  imports: [PrismaModule, AppointmentQueriesModule],
  controllers: [PatientsController],
  providers: [
    {
      provide: PatientDirectory,
      useFactory: (prisma: PrismaService) => new PrismaPatientDirectory(prisma),
      inject: [PrismaService],
    },
    {
      provide: GetPatient,
      useFactory: (directory: PatientDirectory) => new GetPatient(directory),
      inject: [PatientDirectory],
    },
    ...[CreatePatient, UpdatePatient].map((useCase) => ({
      provide: useCase,
      useFactory: (directory: PatientDirectory, clock: Clock) =>
        new useCase(directory, clock),
      inject: [PatientDirectory, Clock],
    })),
    {
      provide: PatientHistory,
      useFactory: (
        patients: PatientDirectory,
        appointments: AppointmentReader,
        clock: Clock,
      ) => new PatientHistory(patients, appointments, clock),
      inject: [PatientDirectory, AppointmentReader, Clock],
    },
  ],
})
export class PatientsModule {}
