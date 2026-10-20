import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentReader } from '../domain/appointment-reader';
import { PrismaAppointmentReader } from './prisma-appointment-reader';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: AppointmentReader,
      useFactory: (prisma: PrismaService) =>
        new PrismaAppointmentReader(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [AppointmentReader],
})
export class AppointmentQueriesModule {}
