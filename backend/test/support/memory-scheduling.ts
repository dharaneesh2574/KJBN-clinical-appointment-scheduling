import { randomUUID } from 'node:crypto';
import {
  Appointment,
  AppointmentStatusEvent,
  createAppointment,
} from '../../src/appointments/domain/appointment';
import {
  SchedulingStores,
  SchedulingUnitOfWork,
  ScheduleReader,
} from '../../src/appointments/domain/scheduling-store';
import { Doctor } from '../../src/doctors/domain/doctor';
import {
  DateOverride,
  WeeklyAvailability,
} from '../../src/availability/domain/availability';
import { RuleError } from '../../src/common/domain/rule-error';

export interface MemoryState {
  doctors: Doctor[];
  patients: string[];
  appointments: Appointment[];
  events: AppointmentStatusEvent[];
  weekly: WeeklyAvailability[];
  overrides: DateOverride[];
}

// Contract double: serialized transactions with copy-on-write commit/rollback.
// Concurrency safety is demonstrated separately against actual PostgreSQL.
export class MemoryScheduling extends SchedulingUnitOfWork {
  state: MemoryState;
  private tail: Promise<void> = Promise.resolve();
  constructor(state: MemoryState) {
    super();
    this.state = structuredClone(state);
  }

  async run<T>(work: (stores: SchedulingStores) => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release = () => {};
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const state = structuredClone(this.state);
    function missing(): never {
      throw new RuleError('NOT_FOUND', 'Resource not found');
    }
    const reader: ScheduleReader = {
      doctor: (id) =>
        Promise.resolve(
          state.doctors.find((item) => item.id === id) ?? missing(),
        ),
      schedule: (doctorId) =>
        Promise.resolve({
          weekly: state.weekly.filter((item) => item.doctorId === doctorId),
          overrides: state.overrides.filter(
            (item) => item.doctorId === doctorId,
          ),
        }),
      doctorAppointments: (doctorId) =>
        Promise.resolve(
          state.appointments
            .filter((item) => item.doctorId === doctorId)
            .sort(
              (a, b) =>
                a.startsAt.localeCompare(b.startsAt) ||
                a.id.localeCompare(b.id),
            ),
        ),
    };
    function event(item: Appointment, now: string, initial: boolean) {
      state.events.push({
        id: randomUUID(),
        appointmentId: item.id,
        fromStatus: initial ? null : 'BOOKED',
        toStatus: item.status,
        occurredAt: now,
      });
    }
    const stores: SchedulingStores = {
      booking: {
        ...reader,
        patientExists: (id) => {
          if (!state.patients.includes(id)) missing();
          return Promise.resolve();
        },
        appointment: (id) =>
          Promise.resolve(
            state.appointments.find((item) => item.id === id) ?? missing(),
          ),
        patientHistory: (id) =>
          Promise.resolve(
            state.appointments
              .filter((item) => item.patientId === id)
              .sort(
                (a, b) =>
                  a.startsAt.localeCompare(b.startsAt) ||
                  a.id.localeCompare(b.id),
              ),
          ),
        insertAppointment: (input, now) => {
          const item = createAppointment({ ...input, id: randomUUID() });
          state.appointments.push(item);
          event(item, now, true);
          return Promise.resolve(item);
        },
        updateAppointment: (input, now) => {
          const index = state.appointments.findIndex(
            (item) => item.id === input.id,
          );
          if (index < 0) missing();
          state.appointments[index] = createAppointment(input);
          event(input, now, false);
          return Promise.resolve(input);
        },
      },
      schedules: {
        ...reader,
        replaceWeekly: (doctorId, weekday, windows) => {
          state.weekly = state.weekly.filter(
            (item) => item.doctorId !== doctorId || item.weekday !== weekday,
          );
          state.weekly.push(
            ...windows.map((window) => ({
              ...window,
              id: randomUUID(),
              doctorId,
              weekday,
            })),
          );
          return Promise.resolve();
        },
        putOverride: (input) => {
          const existing = state.overrides.find(
            (item) =>
              item.doctorId === input.doctorId && item.date === input.date,
          );
          state.overrides = state.overrides.filter((item) => item !== existing);
          state.overrides.push({ ...input, id: existing?.id ?? input.id });
          return Promise.resolve();
        },
        removeOverride: (doctorId, date) => {
          state.overrides = state.overrides.filter(
            (item) => item.doctorId !== doctorId || item.date !== date,
          );
          return Promise.resolve();
        },
        updateDoctor: (input) => {
          const index = state.doctors.findIndex((item) => item.id === input.id);
          if (index < 0) missing();
          state.doctors[index] = input;
          return Promise.resolve();
        },
      },
    };
    try {
      const result = await work(stores);
      this.state = state;
      return structuredClone(result);
    } finally {
      release();
    }
  }
}
