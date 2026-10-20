import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseReadiness } from './database-readiness';

@Injectable()
export class PrismaReadiness implements DatabaseReadiness {
  constructor(private readonly prisma: PrismaService) {}

  async isReady(): Promise<boolean> {
    try {
      await this.prisma.$transaction(
        async (transaction) => {
          await transaction.$executeRaw`SET LOCAL statement_timeout = '1500ms'`;
          await transaction.$queryRaw`SELECT 1 FROM doctors LIMIT 1`;
        },
        { maxWait: 1000, timeout: 2500 },
      );
      return true;
    } catch {
      // Expected probe failure is reported once by the HTTP request logger.
      // Driver messages can contain credentials and must not escape this boundary.
      return false;
    }
  }
}
