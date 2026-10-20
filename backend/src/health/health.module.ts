import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DatabaseReadiness } from './database-readiness';
import { HealthController } from './health.controller';
import { PrismaReadiness } from './prisma-readiness';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [{ provide: DatabaseReadiness, useClass: PrismaReadiness }],
})
export class HealthModule {}
