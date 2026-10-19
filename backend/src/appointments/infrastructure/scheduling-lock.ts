import { Prisma } from '../../generated/prisma/client';

// Also used by the explicit historical seed import, which validates the resulting
// doctor schedules before commit. These keys are stable across processes.
export async function acquireSchedulingLock(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
): Promise<void> {
  await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(1263157838, 2)`;
}
