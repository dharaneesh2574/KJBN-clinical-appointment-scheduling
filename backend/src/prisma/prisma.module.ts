import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ConfigurationModule } from '../common/config/configuration.module';

@Module({
  imports: [ConfigurationModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
