import { randomUUID } from 'node:crypto';
import { DoctorDirectory } from '../domain/doctor-directory';
import { createDoctor, Doctor } from '../domain/doctor';
import {
  DomainValidationError,
  requireId,
} from '../../common/domain/validation';
import { Pagination, requirePagination } from '../../common/domain/pagination';

export class CreateDoctor {
  constructor(private readonly directory: DoctorDirectory) {}
  execute(input: Omit<Doctor, 'id'>): Promise<Doctor> {
    return this.directory.create(createDoctor({ ...input, id: randomUUID() }));
  }
}
export class GetDoctor {
  constructor(private readonly directory: DoctorDirectory) {}
  execute(id: string): Promise<Doctor> {
    return this.directory.get(requireId(id));
  }
}
export class ListDoctors {
  constructor(private readonly directory: DoctorDirectory) {}
  execute(page: Pagination, active?: boolean) {
    if (active !== undefined && typeof active !== 'boolean')
      throw new DomainValidationError('doctor active filter');
    return this.directory.list(requirePagination(page), active);
  }
}
