import { Prisma } from '../../generated/prisma/client';
import { RuleError } from '../../common/domain/rule-error';
import { postgresErrorCode } from './postgres-error-code';

export function translateTransactionError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2028' ||
      error.code === 'P2034' ||
      (error.code === 'P2010' && postgresErrorCode(error.meta) === '55P03'))
  )
    return new RuleError(
      'CONCURRENT_MODIFICATION',
      'Scheduling is busy; retry the operation',
    );
  return error;
}
