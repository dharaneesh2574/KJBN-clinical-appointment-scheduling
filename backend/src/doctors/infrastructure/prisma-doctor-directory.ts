import { PrismaClient } from '../../generated/prisma/client';
import { DoctorDirectory } from '../domain/doctor-directory';
import { createDoctor, Doctor } from '../domain/doctor';
import { Pagination } from '../../common/domain/pagination';
import { RuleError } from '../../common/domain/rule-error';
import { translateTransactionError } from '../../common/infrastructure/transaction-error';
import { acquireSchedulingLock } from '../../common/infrastructure/scheduling-lock';

export class PrismaDoctorDirectory extends DoctorDirectory {
  constructor(private readonly client: PrismaClient) {
    super();
  }
  async create(doctor: Doctor): Promise<Doctor> {
    try {
      return await this.client.$transaction(
        async (tx) => {
          await acquireSchedulingLock(tx);
          return createDoctor(await tx.doctor.create({ data: doctor }));
        },
        { maxWait: 5000, timeout: 15000 },
      );
    } catch (error) {
      throw translateTransactionError(error);
    }
  }
  async get(id: string): Promise<Doctor> {
    const record = await this.client.doctor.findUnique({ where: { id } });
    if (!record) throw new RuleError('NOT_FOUND', 'Doctor not found');
    return createDoctor(record);
  }
  async list(page: Pagination, active?: boolean) {
    return this.client.$transaction(
      async (tx) => {
        const where = active === undefined ? {} : { active };
        const records = await tx.doctor.findMany({
          where,
          skip: page.offset,
          take: page.limit,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        });
        return {
          ...page,
          total: await tx.doctor.count({ where }),
          items: records.map(createDoctor),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
