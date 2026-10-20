import { Prisma, PrismaClient } from '../../generated/prisma/client';
import { PatientDirectory } from '../domain/patient-directory';
import { Patient } from '../domain/patient';
import { RuleError } from '../../common/domain/rule-error';
import { acquireSchedulingLock } from '../../common/infrastructure/scheduling-lock';
import { postgresConstraintIndex } from '../../common/infrastructure/postgres-error-code';
import { translateTransactionError } from '../../common/infrastructure/transaction-error';

export function mapPatient(record: Prisma.PatientGetPayload<object>): Patient {
  return {
    id: record.id,
    name: record.name,
    phone: record.phone,
    dateOfBirth: record.dateOfBirth.toISOString().slice(0, 10),
    flags: [...record.flags],
  };
}
export class PrismaPatientDirectory extends PatientDirectory {
  constructor(private readonly client: PrismaClient) {
    super();
  }
  async get(id: string): Promise<Patient> {
    const record = await this.client.patient.findUnique({ where: { id } });
    if (!record) throw new RuleError('NOT_FOUND', 'Patient not found');
    return mapPatient(record);
  }
  async lookup(phone: string): Promise<Patient> {
    const record = await this.client.patient.findUnique({ where: { phone } });
    if (!record) throw new RuleError('NOT_FOUND', 'Patient not found');
    return mapPatient(record);
  }
  create(patient: Patient): Promise<Patient> {
    return this.write(patient, true);
  }
  update(patient: Patient): Promise<Patient> {
    return this.write(patient, false);
  }
  private async write(patient: Patient, create: boolean): Promise<Patient> {
    try {
      return await this.client.$transaction(
        async (tx) => {
          await acquireSchedulingLock(tx);
          if (
            !create &&
            !(await tx.patient.findUnique({
              where: { id: patient.id },
              select: { id: true },
            }))
          )
            throw new RuleError('NOT_FOUND', 'Patient not found');
          const data = {
            name: patient.name,
            phone: patient.phone,
            dateOfBirth: new Date(`${patient.dateOfBirth}T00:00:00Z`),
            flags: [...patient.flags],
          };
          return mapPatient(
            create
              ? await tx.patient.create({ data: { id: patient.id, ...data } })
              : await tx.patient.update({ where: { id: patient.id }, data }),
          );
        },
        { maxWait: 5000, timeout: 15000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        error.meta?.modelName === 'Patient' &&
        ((Array.isArray(error.meta.target) &&
          error.meta.target.includes('phone')) ||
          postgresConstraintIndex(error.meta) === 'patients_phone_key')
      ) {
        throw new RuleError(
          'PHONE_ALREADY_EXISTS',
          'A patient with this phone already exists',
        );
      }
      throw translateTransactionError(error);
    }
  }
}
