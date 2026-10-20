import {
  Appointment,
  AppointmentStatus,
  AppointmentStatusEvent,
} from './appointment';
import { Page, Pagination } from '../../common/domain/pagination';

export interface AuditedAppointment extends Appointment {
  readonly events: readonly AppointmentStatusEvent[];
}
export interface AppointmentFilter extends Pagination {
  readonly from: string;
  readonly to: string;
  readonly doctorId?: string;
  readonly patientId?: string;
  readonly status?: AppointmentStatus;
}
export interface PatientHistoryPage extends Page<AuditedAppointment> {
  readonly penalties: readonly Appointment[];
}
export abstract class AppointmentReader {
  abstract get(id: string): Promise<AuditedAppointment>;
  abstract list(filter: AppointmentFilter): Promise<Page<Appointment>>;
  abstract history(
    patientId: string,
    page: Pagination,
    from: string,
    now: string,
  ): Promise<PatientHistoryPage>;
}
