import { Doctor } from './doctor';
import { Page, Pagination } from '../../common/domain/pagination';

export abstract class DoctorDirectory {
  abstract create(doctor: Doctor): Promise<Doctor>;
  abstract get(id: string): Promise<Doctor>;
  abstract list(page: Pagination, active?: boolean): Promise<Page<Doctor>>;
}
