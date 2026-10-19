import { Prisma, PrismaClient } from '../../generated/prisma/client';
import {
  SchedulingStores,
  SchedulingUnitOfWork,
} from '../domain/scheduling-store';
import { RuleError } from '../../common/domain/rule-error';
import { postgresErrorCode } from './postgres-error-code';
import { acquireSchedulingLock } from './scheduling-lock';
import { prismaSchedulingStores } from './prisma-scheduling-stores';

export class PrismaSchedulingUnitOfWork extends SchedulingUnitOfWork {
  constructor(private readonly client: PrismaClient) {
    super();
  }

  async run<T>(work: (stores: SchedulingStores) => Promise<T>): Promise<T> {
    try {
      return await this.client.$transaction(
        async (tx) => {
          // One fixed transaction lock for this two-doctor clinic. Acquire before
          // any invariant read, always READ COMMITTED so a waiter sees the winner.
          await acquireSchedulingLock(tx);
          return work(prismaSchedulingStores(tx));
        },
        { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 15000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2028' ||
          error.code === 'P2034' ||
          (error.code === 'P2010' && postgresErrorCode(error.meta) === '55P03'))
      ) {
        throw new RuleError(
          'CONCURRENT_MODIFICATION',
          'Scheduling is busy; retry the operation',
        );
      }
      // Domain errors and unknown persistence failures retain their identity.
      throw error;
    }
  }
}
