import { HttpModule } from './common/http/http.module';
import { PatientsModule } from './patients/patients.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DoctorsModule } from './doctors/doctors.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AvailabilityModule } from './availability/availability.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    HttpModule,
    PatientsModule,
    PrismaModule,
    AppointmentsModule,
    AvailabilityModule,
    DoctorsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
