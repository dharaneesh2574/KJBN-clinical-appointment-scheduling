import { randomUUID } from 'node:crypto';
import {
  CreateDoctor,
  GetDoctor,
  ListDoctors,
} from '../src/doctors/application/doctor-directory';
import { DoctorDirectory } from '../src/doctors/domain/doctor-directory';
import { Doctor } from '../src/doctors/domain/doctor';
import {
  CreatePatient,
  GetPatient,
  UpdatePatient,
} from '../src/patients/application/patient-directory';
import { PatientDirectory } from '../src/patients/domain/patient-directory';
import { Patient } from '../src/patients/domain/patient';
import { PatientHistory } from '../src/patients/application/patient-history';
import { ReadAppointments } from '../src/appointments/application/read-appointments';
import { ReadAvailability } from '../src/availability/application/read-availability';
import {
  Appointment,
  createAppointment,
} from '../src/appointments/domain/appointment';
import {
  AppointmentFilter,
  AppointmentReader,
  AuditedAppointment,
} from '../src/appointments/domain/appointment-reader';
import { FixedClock } from '../src/common/domain/clock';
import { Pagination, requirePagination } from '../src/common/domain/pagination';
import { RuleError } from '../src/common/domain/rule-error';
import { MemoryScheduling } from './support/memory-scheduling';

const doctorId = randomUUID();
const patientId = randomUUID();
const now = '2026-10-19T03:00:00.000Z';
const doctor: Doctor = {
  id: doctorId,
  name: 'Fictional unit doctor',
  speciality: 'General',
  slotMinutes: 15,
  dailyCap: 4,
  active: true,
};
const patient: Patient = {
  id: patientId,
  name: 'Fictional unit patient',
  phone: '+12025550160',
  dateOfBirth: '2000-01-01',
  flags: [],
};
const clock = new FixedClock(now);
class Doctors extends DoctorDirectory {
  records: Doctor[] = [];
  create(item: Doctor) {
    this.records.push(item);
    return Promise.resolve(item);
  }
  get(id: string) {
    const item = this.records.find((record) => record.id === id);
    return item
      ? Promise.resolve(item)
      : Promise.reject(new RuleError('NOT_FOUND', 'Doctor not found'));
  }
  list(page: Pagination, active?: boolean) {
    const records = this.records
      .filter((item) => active === undefined || item.active === active)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return Promise.resolve({
      ...page,
      total: records.length,
      items: records.slice(page.offset, page.offset + page.limit),
    });
  }
}
class Patients extends PatientDirectory {
  records: Patient[] = [];
  create(item: Patient) {
    if (this.records.some((record) => record.phone === item.phone))
      return Promise.reject(
        new RuleError('PHONE_ALREADY_EXISTS', 'Phone already exists'),
      );
    this.records.push(item);
    return Promise.resolve(item);
  }
  update(item: Patient) {
    const index = this.records.findIndex((record) => record.id === item.id);
    if (index < 0)
      return Promise.reject(new RuleError('NOT_FOUND', 'Patient not found'));
    if (
      this.records.some(
        (record) => record.id !== item.id && record.phone === item.phone,
      )
    )
      return Promise.reject(
        new RuleError('PHONE_ALREADY_EXISTS', 'Phone already exists'),
      );
    this.records[index] = item;
    return Promise.resolve(item);
  }
  get(id: string) {
    const item = this.records.find((record) => record.id === id);
    return item
      ? Promise.resolve(item)
      : Promise.reject(new RuleError('NOT_FOUND', 'Patient not found'));
  }
  lookup(phone: string) {
    const item = this.records.find((record) => record.phone === phone);
    return item
      ? Promise.resolve(item)
      : Promise.reject(new RuleError('NOT_FOUND', 'Patient not found'));
  }
}
function fixture(change: Partial<Appointment> = {}): AuditedAppointment {
  const item = createAppointment({
    id: randomUUID(),
    doctorId,
    patientId,
    startsAt: '2026-10-19T03:30:00Z',
    endsAt: '2026-10-19T03:45:00Z',
    status: 'BOOKED',
    slotMinutes: 15,
    reason: 'Fictional unit booking',
    cancelledAt: null,
    depositAcknowledgedAt: null,
    rescheduledFromId: null,
    ...change,
  });
  return { ...item, events: [] };
}
class Appointments extends AppointmentReader {
  records: AuditedAppointment[] = [];
  get(id: string) {
    const item = this.records.find((record) => record.id === id);
    return item
      ? Promise.resolve(item)
      : Promise.reject(new RuleError('NOT_FOUND', 'Appointment not found'));
  }
  list(filter: AppointmentFilter) {
    const records = this.records
      .filter(
        (item) =>
          item.startsAt >= filter.from &&
          item.startsAt < filter.to &&
          (filter.doctorId === undefined ||
            item.doctorId === filter.doctorId) &&
          (filter.patientId === undefined ||
            item.patientId === filter.patientId) &&
          (filter.status === undefined || item.status === filter.status),
      )
      .sort(
        (a, b) =>
          a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id),
      );
    return Promise.resolve({
      offset: filter.offset,
      limit: filter.limit,
      total: records.length,
      items: records.slice(filter.offset, filter.offset + filter.limit),
    });
  }
  history(id: string, page: Pagination, from: string, through: string) {
    const records = this.records
      .filter((item) => item.patientId === id)
      .sort(
        (a, b) =>
          b.startsAt.localeCompare(a.startsAt) || a.id.localeCompare(b.id),
      );
    const penalties = records.filter((item) => {
      const at =
        item.status === 'NO_SHOW'
          ? item.startsAt
          : item.status === 'LATE_CANCELLED'
            ? item.cancelledAt
            : null;
      return at !== null && at > from && at <= through;
    });
    return Promise.resolve({
      ...page,
      total: records.length,
      items: records.slice(page.offset, page.offset + page.limit),
      penalties,
    });
  }
}

describe('M3 — directory application validation and ports', () => {
  test('doctor creation validates data, allocates an ID, and supports canonical get and filtered pagination', async () => {
    const directory = new Doctors();
    const created = await new CreateDoctor(directory).execute(doctor);
    expect(created.id).not.toBe(doctorId);
    expect(created).toMatchObject({ name: doctor.name, slotMinutes: 15 });
    await expect(
      new GetDoctor(directory).execute(created.id.toUpperCase()),
    ).resolves.toEqual(created);
    await new CreateDoctor(directory).execute({ ...doctor, active: false });
    const page = await new ListDoctors(directory).execute(
      { offset: 0, limit: 1 },
      true,
    );
    expect(page.items).toEqual([created]);
    expect(page.total).toBe(1);
    await expect(
      new GetDoctor(directory).execute(randomUUID()),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  test('doctor validation holds outside HTTP and does not write on failure', () => {
    const directory = new Doctors();
    expect(() =>
      new CreateDoctor(directory).execute({ ...doctor, dailyCap: 0 }),
    ).toThrow();
    expect(() =>
      new ListDoctors(directory).execute({ offset: 0, limit: 0 }),
    ).toThrow();
    const invalid = { value: true };
    Object.defineProperty(invalid, 'value', { value: 'true' });
    expect(() =>
      new ListDoctors(directory).execute(
        { offset: 0, limit: 1 },
        invalid.value,
      ),
    ).toThrow();
    expect(directory.records).toEqual([]);
  });
  test('patient creation/update validates DOB and phone against one injected clock snapshot', async () => {
    const directory = new Patients();
    const counted = { now: jest.fn(() => now) };
    const created = await new CreatePatient(directory, counted).execute({
      ...patient,
      phone: '+1 (202) 555-0160',
    });
    expect(counted.now).toHaveBeenCalledTimes(1);
    expect(created.phone).toBe(patient.phone);
    await expect(
      new GetPatient(directory).lookup('+1 202 555 0160'),
    ).resolves.toEqual(created);
    const updated = await new UpdatePatient(directory, clock).execute(
      created.id.toUpperCase(),
      { ...patient, name: 'Changed unit patient' },
    );
    expect(updated.name).toBe('Changed unit patient');
    await expect(
      new GetPatient(directory).execute(created.id),
    ).resolves.toEqual(updated);
    expect(() =>
      new CreatePatient(directory, clock).execute({
        ...patient,
        dateOfBirth: '2026-10-20',
      }),
    ).toThrow();
    await expect(
      new UpdatePatient(directory, clock).execute(randomUUID(), patient),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  test('duplicate normalized phones reject through the port without altering data', async () => {
    const directory = new Patients();
    await new CreatePatient(directory, clock).execute(patient);
    await expect(
      new CreatePatient(directory, clock).execute({
        ...patient,
        phone: '+1 202-555-0160',
      }),
    ).rejects.toMatchObject({ code: 'PHONE_ALREADY_EXISTS' });
    expect(directory.records).toHaveLength(1);
  });
  test('reject missing/wrong patient flags and phone outside DTOs', () => {
    const directory = new Patients();
    const missing = { ...patient };
    Object.defineProperty(missing, 'flags', { value: undefined });
    expect(() =>
      new CreatePatient(directory, clock).execute(missing),
    ).toThrow();
    const bad = { ...patient };
    Object.defineProperty(bad, 'phone', { value: 123 });
    expect(() => new CreatePatient(directory, clock).execute(bad)).toThrow();
  });
});
describe('M3 — time-aware read use cases', () => {
  test('default appointment day follows IST across a UTC midnight boundary with stable filters and pagination', async () => {
    const reader = new Appointments();
    const included = fixture({
      startsAt: '2026-10-19T18:30:00Z',
      endsAt: '2026-10-19T18:45:00Z',
    });
    reader.records = [fixture(), included];
    const reads = new ReadAppointments(
      reader,
      new FixedClock('2026-10-19T19:00:00Z'),
    );
    const page = await reads.list({
      offset: 0,
      limit: 1,
      doctorId,
      patientId,
      status: 'BOOKED',
    });
    expect(page.items).toEqual([included]);
    expect(page.total).toBe(1);
    await expect(reads.get(included.id.toUpperCase())).resolves.toEqual(
      included,
    );
    const before = structuredClone(reader.records);
    await reads.list({ offset: 0, limit: 1, date: '2026-10-19' });
    expect(reader.records).toEqual(before);
  });
  test('reject malformed day/status/filter/page outside HTTP', () => {
    const reads = new ReadAppointments(new Appointments(), clock);
    expect(() =>
      reads.list({ offset: 0, limit: 1, date: '2026-02-30' }),
    ).toThrow();
    expect(() =>
      reads.list({ offset: 0, limit: 1, doctorId: 'bad' }),
    ).toThrow();
    expect(() =>
      reads.list({ offset: 0, limit: 1, patientId: 'bad' }),
    ).toThrow();
    const invalid = { offset: 0, limit: 1, status: 'BOOKED' as const };
    Object.defineProperty(invalid, 'status', { value: 'invalid' });
    expect(() => reads.list(invalid)).toThrow();
  });
  test('patient history computes eligibility from all recent penalties while returning only a page', async () => {
    const patients = new Patients();
    patients.records = [patient];
    const reader = new Appointments();
    reader.records = [
      fixture({
        status: 'NO_SHOW',
        startsAt: '2026-10-18T03:30:00Z',
        endsAt: '2026-10-18T03:45:00Z',
      }),
      fixture({
        status: 'LATE_CANCELLED',
        cancelledAt: '2026-10-18T03:00:00Z',
      }),
    ];
    const counted = { now: jest.fn(() => now) };
    const result = await new PatientHistory(patients, reader, counted).execute(
      patientId,
      { offset: 1, limit: 1 },
    );
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.deposit).toMatchObject({
      required: true,
      penaltyCount: 2,
      asOf: now,
    });
    expect(counted.now).toHaveBeenCalledTimes(1);
    const after = await new PatientHistory(
      patients,
      reader,
      new FixedClock('2026-11-19T03:00:00Z'),
    ).execute(patientId, { offset: 0, limit: 20 });
    expect(after.deposit.required).toBe(false);
    await expect(
      new PatientHistory(patients, reader, clock).execute(randomUUID(), {
        offset: 0,
        limit: 20,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  test('availability defaults to 60 days from the IST date and filters date overrides without mutation', async () => {
    const db = new MemoryScheduling({
      doctors: [doctor],
      patients: [],
      appointments: [],
      events: [],
      weekly: [],
      overrides: [
        {
          id: randomUUID(),
          doctorId,
          date: '2026-10-20',
          reason: 'Leave',
          windows: [],
        },
        {
          id: randomUUID(),
          doctorId,
          date: '2027-01-01',
          reason: 'Later',
          windows: [],
        },
      ],
    });
    const reads = new ReadAvailability(db, clock);
    const before = structuredClone(db.state);
    const result = await reads.execute(doctorId);
    expect(result.from).toBe('2026-10-19');
    expect(result.to).toBe('2026-12-18');
    expect(result.overrides).toHaveLength(1);
    expect(db.state).toEqual(before);
    expect(
      (await reads.execute(doctorId, '2027-01-01', '2027-01-01')).overrides,
    ).toHaveLength(1);
    expect(() => reads.execute(doctorId, '2026-10-20', '2026-10-19')).toThrow();
    expect(() => reads.execute(doctorId, '2026-01-01', '2028-01-01')).toThrow();
    await expect(reads.execute(randomUUID())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
  test.each([
    { offset: -1, limit: 20 },
    { offset: 0, limit: 0 },
    { offset: 0, limit: 101 },
    { offset: 1000001, limit: 20 },
    { offset: 0.1, limit: 20 },
  ])('bound pagination %j', (value) => {
    expect(() => requirePagination(value)).toThrow();
  });
});
