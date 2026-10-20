import { Patient } from './patient';
export abstract class PatientDirectory {
  abstract create(patient: Patient): Promise<Patient>;
  abstract update(patient: Patient): Promise<Patient>;
  abstract get(id: string): Promise<Patient>;
  abstract lookup(phone: string): Promise<Patient>;
}
