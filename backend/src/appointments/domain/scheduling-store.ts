import { Appointment } from './appointment';
import { Doctor } from '../../doctors/domain/doctor';
import { DoctorSchedule } from '../../availability/domain/effective-availability';
import {
  AvailabilityWindow,
  DateOverride,
} from '../../availability/domain/availability';

export interface ScheduleReader {
  doctor(id: string): Promise<Doctor>;
  schedule(doctorId: string): Promise<DoctorSchedule>;
  doctorAppointments(doctorId: string): Promise<readonly Appointment[]>;
}

export interface BookingStore extends ScheduleReader {
  patientExists(id: string): Promise<void>;
  appointment(id: string): Promise<Appointment>;
  patientHistory(patientId: string): Promise<readonly Appointment[]>;
  // Each write includes its status event in the enclosing transaction.
  insertAppointment(
    input: Omit<Appointment, 'id'>,
    now: string,
  ): Promise<Appointment>;
  updateAppointment(input: Appointment, now: string): Promise<Appointment>;
}

export interface ScheduleStore extends ScheduleReader {
  replaceWeekly(
    doctorId: string,
    weekday: number,
    windows: readonly AvailabilityWindow[],
  ): Promise<void>;
  putOverride(override: DateOverride): Promise<void>;
  removeOverride(doctorId: string, date: string): Promise<void>;
  updateDoctor(doctor: Doctor): Promise<void>;
}

export interface SchedulingStores {
  readonly booking: BookingStore;
  readonly schedules: ScheduleStore;
}

// All invariant-affecting writers must use this boundary. Failure rolls back
// appointments, status events, overrides, and doctor settings together.
export abstract class SchedulingUnitOfWork {
  abstract run<T>(work: (stores: SchedulingStores) => Promise<T>): Promise<T>;
}
