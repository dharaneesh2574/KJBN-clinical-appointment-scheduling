import { randomUUID } from 'node:crypto';
import { PatientDirectory } from '../domain/patient-directory';
import { createPatient, normalizePhone, Patient } from '../domain/patient';
import { Clock } from '../../common/domain/clock';
import { clinicDate } from '../../common/domain/clinic-time';
import { requireId, requireInstant } from '../../common/domain/validation';

export class CreatePatient {
  constructor(
    private readonly directory: PatientDirectory,
    private readonly clock: Clock,
  ) {}
  execute(input: Omit<Patient, 'id'>): Promise<Patient> {
    const now = requireInstant(this.clock.now());
    return this.directory.create(
      createPatient({ ...input, id: randomUUID() }, clinicDate(now)),
    );
  }
}
export class UpdatePatient {
  constructor(
    private readonly directory: PatientDirectory,
    private readonly clock: Clock,
  ) {}
  execute(id: string, input: Omit<Patient, 'id'>): Promise<Patient> {
    const now = requireInstant(this.clock.now());
    return this.directory.update(
      createPatient({ ...input, id: requireId(id) }, clinicDate(now)),
    );
  }
}
export class GetPatient {
  constructor(private readonly directory: PatientDirectory) {}
  execute(id: string): Promise<Patient> {
    return this.directory.get(requireId(id));
  }
  lookup(phone: string): Promise<Patient> {
    return this.directory.lookup(normalizePhone(phone));
  }
}
