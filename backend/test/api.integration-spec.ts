import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import type { Response as TestResponse } from 'supertest';
import type { App } from 'supertest/types';
import { PrismaClient } from '../src/generated/prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppConfig } from '../src/common/config/app-config';
import { configureHttp } from '../src/common/http/configure-http';
import { RequestLog, RequestLogger } from '../src/common/http/request-logger';
import { SystemClock } from '../src/common/infrastructure/system-clock';
import { AppointmentReader } from '../src/appointments/domain/appointment-reader';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.startsWith('/kjbn_test_'))
  throw new Error(
    'Use TEST_DATABASE_URL pointing to an isolated kjbn_test_* database',
  );
const client = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const now = '2026-10-19T03:00:00.000Z';
const systemClock = { now: jest.fn(() => now) };
const logs: RequestLog[] = [];
let app: INestApplication<App>;
let doctorId: string;
let otherDoctorId: string;
let patientId: string;
let otherPatientId: string;
let doctors: string[] = [];
let patients: string[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected object response');
  return value;
}
function body(response: TestResponse): Record<string, unknown> {
  const value: unknown = response.body;
  return object(value);
}
function items(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected array response');
  return value;
}
function idOf(response: TestResponse): string {
  const id = body(response).id;
  if (typeof id !== 'string') throw new Error('Expected response ID');
  return id;
}
function booking(extra: Readonly<Record<string, unknown>> = {}) {
  return {
    doctorId,
    patientId,
    startsAt: '2026-10-19T09:00:00+05:30',
    reason: 'Fictional API consultation',
    depositAcknowledged: false,
    ...extra,
  };
}
const doctorInput = {
  name: 'Fictional API doctor',
  speciality: 'General',
  slotMinutes: 15,
  dailyCap: 4,
  active: true,
};
const patientInput = {
  name: 'Fictional API patient',
  phone: '+12025550150',
  dateOfBirth: '2000-01-01',
  flags: [],
};
async function createApp(reviewMode: boolean): Promise<INestApplication<App>> {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(client)
    .overrideProvider(AppConfig)
    .useValue(
      AppConfig.fromEnvironment({
        DATABASE_URL: databaseUrl,
        REVIEW_MODE: String(reviewMode),
        NODE_ENV: 'test',
      }),
    )
    .overrideProvider(SystemClock)
    .useValue(systemClock)
    .overrideProvider(RequestLogger)
    .useValue({
      write: (record: RequestLog) => {
        logs.push(record);
      },
    })
    .compile();
  const application = module.createNestApplication<INestApplication<App>>({
    logger: false,
  });
  configureHttp(application);
  await application.init();
  return application;
}
async function createDoctor(
  extra: Readonly<Record<string, unknown>> = {},
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/doctors')
    .send({ ...doctorInput, ...extra })
    .expect(201);
  const id = idOf(response);
  doctors.push(id);
  return id;
}
async function createPatient(
  extra: Readonly<Record<string, unknown>> = {},
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/patients')
    .send({ ...patientInput, ...extra })
    .expect(201);
  const id = idOf(response);
  patients.push(id);
  return id;
}
beforeAll(async () => {
  try {
    await promisify(execFile)(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      { env: { ...process.env, DATABASE_URL: databaseUrl } },
    );
  } catch {
    throw new Error('Isolated API test migration failed');
  }
  app = await createApp(true);
});
afterAll(async () => {
  await app.close();
  await client.$disconnect();
});
beforeEach(async () => {
  doctors = [];
  patients = [];
  logs.length = 0;
  doctorId = await createDoctor();
  otherDoctorId = await createDoctor({ slotMinutes: 30 });
  patientId = await createPatient();
  otherPatientId = await createPatient({ phone: '+12025550151' });
  for (const id of doctors)
    await request(app.getHttpServer())
      .put(`/doctors/${id}/availability/weekly/1`)
      .send({ windows: [{ startMinute: 540, endMinute: 720 }] })
      .expect(204);
  logs.length = 0;
  systemClock.now.mockClear();
});
afterEach(async () => {
  jest.restoreAllMocks();
  await client.appointmentStatusEvent.deleteMany({
    where: { appointment: { doctorId: { in: doctors } } },
  });
  await client.appointment.deleteMany({
    where: { doctorId: { in: doctors }, rescheduledFromId: { not: null } },
  });
  await client.appointment.deleteMany({ where: { doctorId: { in: doctors } } });
  await client.availabilityOverride.deleteMany({
    where: { doctorId: { in: doctors } },
  });
  await client.weeklyAvailability.deleteMany({
    where: { doctorId: { in: doctors } },
  });
  await client.doctor.deleteMany({ where: { id: { in: doctors } } });
  await client.patient.deleteMany({ where: { id: { in: patients } } });
});

describe('M3 — HTTP directories and contract validation', () => {
  test('create/list/get/replace doctor with explicit response fields and bounded pagination', async () => {
    const response = await request(app.getHttpServer())
      .get(`/doctors/${doctorId}`)
      .expect(200);
    expect(Object.keys(body(response)).sort()).toEqual(
      ['id', 'name', 'speciality', 'slotMinutes', 'dailyCap', 'active'].sort(),
    );
    expect(body(response)).toMatchObject(doctorInput);
    await request(app.getHttpServer())
      .put(`/doctors/${doctorId}`)
      .send({ ...doctorInput, dailyCap: 5 })
      .expect(204);
    expect(
      body(
        await request(app.getHttpServer())
          .get(`/doctors/${doctorId}`)
          .expect(200),
      ).dailyCap,
    ).toBe(5);
    const list = body(
      await request(app.getHttpServer())
        .get('/doctors')
        .query({ limit: 1, offset: 0, active: true })
        .expect(200),
    );
    expect(items(list.items)).toHaveLength(1);
    expect(list.limit).toBe(1);
    expect(list.total).toBeGreaterThanOrEqual(2);
  });
  test.each([
    { name: undefined },
    { slotMinutes: 20 },
    { slotMinutes: '15' },
    { dailyCap: 0 },
    { dailyCap: 2147483648 },
    { dailyCap: 1.5 },
    { active: 'true' },
    { extra: 'forbidden' },
    { name: '   ' },
  ])('reject invalid doctor DTO %j', async (change) => {
    const response = await request(app.getHttpServer())
      .post('/doctors')
      .send({ ...doctorInput, ...change })
      .expect(400);
    expect(typeof body(response).requestId).toBe('string');
    expect(['VALIDATION_FAILED', 'INVALID_DOMAIN_VALUE']).toContain(
      body(response).code,
    );
  });
  test.each([
    { limit: 0 },
    { limit: 101 },
    { offset: -1 },
    { offset: 1000001 },
    { limit: '1.5' },
    { active: 'yes' },
    { extra: 'unexpected' },
  ])('reject malformed/unknown query %j', async (query) => {
    const response = await request(app.getHttpServer())
      .get('/doctors')
      .query(query)
      .expect(400);
    expect(body(response).code).toBe('VALIDATION_FAILED');
  });
  test('normalize phone on creation, support lookup and replace patient with explicit response mapping', async () => {
    const id = await createPatient({
      phone: '+1 (202) 555-0152',
      flags: ['MOBILITY_ASSISTANCE'],
    });
    const found = body(
      await request(app.getHttpServer())
        .get('/patients/lookup')
        .query({ phone: '+1 202-555-0152' })
        .expect(200),
    );
    expect(found.id).toBe(id);
    expect(found.phone).toBe('+12025550152');
    expect(Object.keys(found).sort()).toEqual(
      ['id', 'name', 'phone', 'dateOfBirth', 'flags'].sort(),
    );
    await request(app.getHttpServer())
      .put(`/patients/${id}`)
      .send({
        ...patientInput,
        phone: '+12025550152',
        name: 'Updated fictional patient',
      })
      .expect(200);
    expect(
      body(
        await request(app.getHttpServer()).get(`/patients/${id}`).expect(200),
      ).name,
    ).toBe('Updated fictional patient');
  });
  test('duplicate normalized phone creates a deliberate 409 and leaves patient unchanged', async () => {
    const response = await request(app.getHttpServer())
      .post('/patients')
      .send({ ...patientInput, phone: '+1 (202) 555-0150' })
      .expect(409);
    expect(body(response).code).toBe('PHONE_ALREADY_EXISTS');
    await request(app.getHttpServer())
      .put(`/patients/${otherPatientId}`)
      .send(patientInput)
      .expect(409);
    expect(
      body(
        await request(app.getHttpServer())
          .get(`/patients/${otherPatientId}`)
          .expect(200),
      ).phone,
    ).toBe('+12025550151');
  });
  test.each([
    { phone: '2025550153' },
    { dateOfBirth: '2026-02-30' },
    { dateOfBirth: '2026-10-20' },
    { flags: ['DEPOSIT_REQUIRED'] },
    { flags: ['MOBILITY_ASSISTANCE', 'MOBILITY_ASSISTANCE'] },
    { flags: 'MOBILITY_ASSISTANCE' },
    { flags: undefined },
    { name: 42 },
    { extra: true },
  ])('reject invalid patient %j', async (change) => {
    await request(app.getHttpServer())
      .post('/patients')
      .send({ ...patientInput, phone: '+12025550153', ...change })
      .expect(400);
  });
  test('DOB validation uses the reviewer date rather than a conflicting DB/system date', async () => {
    const response = await request(app.getHttpServer())
      .post('/patients')
      .set('X-Review-Now', '2028-01-01T00:00:00Z')
      .send({
        ...patientInput,
        phone: '+12025550154',
        dateOfBirth: '2027-12-31',
      })
      .expect(201);
    patients.push(idOf(response));
    expect(body(response).dateOfBirth).toBe('2027-12-31');
    await request(app.getHttpServer())
      .post('/patients')
      .set('X-Review-Now', '2028-01-01T00:00:00Z')
      .send({
        ...patientInput,
        phone: '+12025550155',
        dateOfBirth: '2028-01-02',
      })
      .expect(400);
  });
  test('validate IDs and distinguish absent resources from malformed requests', async () => {
    await request(app.getHttpServer()).get('/doctors/not-a-uuid').expect(400);
    for (const path of [
      `/doctors/${randomUUID()}`,
      `/patients/${randomUUID()}`,
      `/appointments/${randomUUID()}`,
    ])
      expect(
        body(await request(app.getHttpServer()).get(path).expect(404)).code,
      ).toBe('NOT_FOUND');
    await request(app.getHttpServer())
      .get('/patients/lookup')
      .query({ phone: '+12025550159' })
      .expect(404);
    const response = await request(app.getHttpServer())
      .get('/unknown-route-private-data')
      .expect(404);
    expect(body(response)).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
    expect(JSON.stringify(logs)).not.toContain('unknown-route-private-data');
  });
  test('malformed JSON receives the safe envelope and a correlation ID', async () => {
    const response = await request(app.getHttpServer())
      .post('/patients')
      .set('Content-Type', 'application/json')
      .send('{"secret-phone":"+12025550150",')
      .expect(400);
    expect(body(response)).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Malformed request',
    });
    expect(JSON.stringify(body(response))).not.toContain('secret-phone');
  });
});

describe('M3 — real booking, scheduling and history workflows', () => {
  test('R1/R7: valid-slot booking derives UTC end, records history and removes the advisory slot', async () => {
    const slots = await request(app.getHttpServer())
      .get(`/doctors/${doctorId}/slots`)
      .query({ date: '2026-10-19' })
      .expect(200);
    const raw: unknown = slots.body;
    expect(items(raw)).toHaveLength(12);
    const response = await request(app.getHttpServer())
      .post('/appointments')
      .send(booking())
      .expect(201);
    expect(body(response)).toMatchObject({
      startsAt: '2026-10-19T03:30:00.000Z',
      endsAt: '2026-10-19T03:45:00.000Z',
      slotMinutes: 15,
      status: 'BOOKED',
    });
    expect(body(response)).not.toHaveProperty('createdAt');
    expect(body(response)).not.toHaveProperty('updatedAt');
    const detail = body(
      await request(app.getHttpServer())
        .get(`/appointments/${idOf(response)}`)
        .expect(200),
    );
    expect(items(detail.events)).toHaveLength(1);
    expect(object(items(detail.events)[0])).toMatchObject({
      fromStatus: null,
      toStatus: 'BOOKED',
      occurredAt: now,
    });
    const queue = body(
      await request(app.getHttpServer())
        .get('/appointments')
        .query({ status: 'BOOKED', doctorId })
        .expect(200),
    );
    expect(items(queue.items)).toHaveLength(1);
    expect(queue.total).toBe(1);
    const after = await request(app.getHttpServer())
      .get(`/doctors/${doctorId}/slots`)
      .query({ date: '2026-10-19' })
      .expect(200);
    const value: unknown = after.body;
    expect(items(value)).toHaveLength(11);
  });
  test.each([
    { startsAt: '2026-10-19T09:00:00' },
    { startsAt: '2026-02-30T09:00:00Z' },
    { doctorId: 'bad' },
    { patientId: undefined },
    { depositAcknowledged: 'false' },
    { endsAt: '2026-10-19T10:00:00Z' },
    { status: 'COMPLETED' },
    { reason: '' },
  ])('reject invalid booking body %j', async (change) => {
    expect(
      body(
        await request(app.getHttpServer())
          .post('/appointments')
          .send(booking(change))
          .expect(400),
      ).code,
    ).toBe('VALIDATION_FAILED');
  });
  test.each([
    ['2026-10-19T03:31:00Z', 'OFF_GRID'],
    ['2026-10-19T02:00:00Z', 'BOOKING_HORIZON'],
    ['2026-12-19T03:30:00Z', 'BOOKING_HORIZON'],
  ])('reject slot %s with stable rule code %s', async (startsAt, code) => {
    expect(
      body(
        await request(app.getHttpServer())
          .post('/appointments')
          .send(booking({ startsAt }))
          .expect(409),
      ).code,
    ).toBe(code);
  });
  test('R2: simultaneous same-doctor HTTP bookings produce exactly one 201 and one 409', async () => {
    const responses = await Promise.all([
      request(app.getHttpServer()).post('/appointments').send(booking()),
      request(app.getHttpServer())
        .post('/appointments')
        .send(booking({ patientId: otherPatientId })),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const loser = responses.find((response) => response.status === 409);
    if (!loser) throw new Error('Expected conflict');
    expect(body(loser).code).toBe('DOCTOR_OVERLAP');
  });
  test('R3: patient overlap across doctors is rejected through HTTP', async () => {
    await request(app.getHttpServer())
      .post('/appointments')
      .send(booking())
      .expect(201);
    expect(
      body(
        await request(app.getHttpServer())
          .post('/appointments')
          .send(booking({ doctorId: otherDoctorId }))
          .expect(409),
      ).code,
    ).toBe('PATIENT_OVERLAP');
  });
  test('R4: concurrent distinct slots cannot claim the same last daily capacity', async () => {
    await request(app.getHttpServer())
      .put(`/doctors/${doctorId}`)
      .send({ ...doctorInput, dailyCap: 1 })
      .expect(204);
    const responses = await Promise.all([
      request(app.getHttpServer()).post('/appointments').send(booking()),
      request(app.getHttpServer())
        .post('/appointments')
        .send(
          booking({
            patientId: otherPatientId,
            startsAt: '2026-10-19T03:45:00Z',
          }),
        ),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const loser = responses.find((response) => response.status === 409);
    if (!loser) throw new Error('Expected conflict');
    expect(body(loser).code).toBe('DAILY_CAP_REACHED');
  });
  test('R1: protect availability and doctor settings; return affected IDs', async () => {
    const response = await request(app.getHttpServer())
      .post('/appointments')
      .send(booking())
      .expect(201);
    const id = idOf(response);
    const conflict = body(
      await request(app.getHttpServer())
        .put(`/doctors/${doctorId}/availability/overrides/2026-10-19`)
        .send({ reason: 'Fictional leave', windows: [] })
        .expect(409),
    );
    expect(conflict).toMatchObject({
      code: 'SCHEDULE_CONFLICT',
      details: { appointmentIds: [id] },
    });
    await request(app.getHttpServer())
      .put(`/doctors/${doctorId}`)
      .send({ ...doctorInput, active: false })
      .expect(409);
    expect(
      body(
        await request(app.getHttpServer())
          .get(`/doctors/${doctorId}`)
          .expect(200),
      ).active,
    ).toBe(true);
  });
  test('R1: replace weekly/date windows, support leave/extra day, restore weekly after override deletion', async () => {
    const path = `/doctors/${doctorId}/availability`;
    await request(app.getHttpServer())
      .put(`${path}/overrides/2026-10-19`)
      .send({ reason: 'Leave', windows: [] })
      .expect(204);
    expect(
      body(
        await request(app.getHttpServer())
          .post('/appointments')
          .send(booking())
          .expect(409),
      ).code,
    ).toBe('OUTSIDE_AVAILABILITY');
    await request(app.getHttpServer())
      .delete(`${path}/overrides/2026-10-19`)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`${path}/overrides/2026-10-19`)
      .expect(204);
    await request(app.getHttpServer())
      .put(`${path}/overrides/2026-10-25`)
      .send({
        reason: 'Sunday',
        windows: [{ startMinute: 600, endMinute: 660 }],
      })
      .expect(204);
    await request(app.getHttpServer())
      .put(`${path}/overrides/2026-10-25`)
      .send({
        reason: 'Changed Sunday',
        windows: [
          { startMinute: 540, endMinute: 570 },
          { startMinute: 840, endMinute: 870 },
        ],
      })
      .expect(204);
    const response = body(
      await request(app.getHttpServer())
        .get(path)
        .query({ from: '2026-10-19', to: '2026-10-25' })
        .expect(200),
    );
    expect(items(response.overrides)).toHaveLength(1);
    expect(items(object(items(response.overrides)[0]).windows)).toHaveLength(2);
    await request(app.getHttpServer())
      .post('/appointments')
      .send(booking({ startsAt: '2026-10-25T03:30:00Z' }))
      .expect(201);
    await request(app.getHttpServer())
      .delete(`${path}/overrides/2026-10-25`)
      .expect(409);
  });
  test.each([
    { windows: [{ startMinute: 540, endMinute: 600, extra: true }] },
    { windows: 'invalid' },
    { windows: [{ startMinute: 540, endMinute: 500 }] },
    {
      windows: [
        { startMinute: 540, endMinute: 600 },
        { startMinute: 590, endMinute: 620 },
      ],
    },
  ])('reject invalid/nested availability %j', async (input) => {
    await request(app.getHttpServer())
      .put(`/doctors/${doctorId}/availability/weekly/1`)
      .send(input)
      .expect(400);
  });
  test('validate weekday, local dates and bounded availability range', async () => {
    await request(app.getHttpServer())
      .put(`/doctors/${doctorId}/availability/weekly/8`)
      .send({ windows: [] })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/doctors/${doctorId}/availability/overrides/2026-02-30`)
      .send({ reason: 'Invalid day', windows: [] })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/doctors/${doctorId}/availability`)
      .query({ from: '2026-10-20', to: '2026-10-19' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/doctors/${doctorId}/availability`)
      .query({ from: '2026-01-01', to: '2028-01-01' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/doctors/${doctorId}/slots`)
      .expect(400);
  });
  test('R6: failed replacement preserves original/history; valid replacement links both doctors', async () => {
    const original = idOf(
      await request(app.getHttpServer())
        .post('/appointments')
        .send(booking())
        .expect(201),
    );
    const before = body(
      await request(app.getHttpServer())
        .get(`/appointments/${original}`)
        .expect(200),
    );
    const replacement = {
      doctorId: otherDoctorId,
      startsAt: '2026-10-19T04:00:00Z',
      reason: 'Fictional replacement',
      depositAcknowledged: false,
    };
    expect(
      body(
        await request(app.getHttpServer())
          .post(`/appointments/${original}/reschedules`)
          .send({ ...replacement, startsAt: '2026-10-19T04:01:00Z' })
          .expect(409),
      ).code,
    ).toBe('OFF_GRID');
    expect(
      body(
        await request(app.getHttpServer())
          .get(`/appointments/${original}`)
          .expect(200),
      ),
    ).toEqual(before);
    const next = body(
      await request(app.getHttpServer())
        .post(`/appointments/${original}/reschedules`)
        .send(replacement)
        .expect(201),
    );
    expect(next).toMatchObject({
      doctorId: otherDoctorId,
      patientId,
      rescheduledFromId: original,
      slotMinutes: 30,
    });
    const cancelled = body(
      await request(app.getHttpServer())
        .get(`/appointments/${original}`)
        .expect(200),
    );
    expect(cancelled.status).toBe('LATE_CANCELLED');
    expect(items(cancelled.events)).toHaveLength(2);
    await request(app.getHttpServer())
      .post(`/appointments/${original}/reschedules`)
      .send(replacement)
      .expect(409);
  });
  test.each([
    [119, 'LATE_CANCELLED'],
    [120, 'CANCELLED'],
    [121, 'CANCELLED'],
  ])(
    'R5: cancellation at %s minutes produces %s and is idempotent',
    async (minutes, status) => {
      const id = idOf(
        await request(app.getHttpServer())
          .post('/appointments')
          .send(booking())
          .expect(201),
      );
      const at = new Date(
        Date.parse('2026-10-19T03:30:00Z') - Number(minutes) * 60000,
      ).toISOString();
      const response = body(
        await request(app.getHttpServer())
          .post(`/appointments/${id}/cancellation`)
          .set('X-Review-Now', at)
          .expect(200),
      );
      expect(response).toMatchObject({ status, cancelledAt: at });
      expect(
        body(
          await request(app.getHttpServer())
            .post(`/appointments/${id}/cancellation`)
            .expect(200),
        ),
      ).toEqual(response);
      await request(app.getHttpServer())
        .post(`/appointments/${id}/cancellation`)
        .send({ status: 'COMPLETED' })
        .expect(400);
    },
  );
  test.each(['COMPLETED', 'NO_SHOW'])(
    'R5: mark %s only after end; reject arbitrary/final transitions',
    async (status) => {
      const id = idOf(
        await request(app.getHttpServer())
          .post('/appointments')
          .send(booking())
          .expect(201),
      );
      await request(app.getHttpServer())
        .patch(`/appointments/${id}/status`)
        .send({ status })
        .expect(409);
      expect(
        body(
          await request(app.getHttpServer())
            .patch(`/appointments/${id}/status`)
            .set('X-Review-Now', '2026-10-19T03:45:00Z')
            .send({ status })
            .expect(200),
        ).status,
      ).toBe(status);
      await request(app.getHttpServer())
        .patch(`/appointments/${id}/status`)
        .set('X-Review-Now', '2026-10-19T04:00:00Z')
        .send({ status })
        .expect(409);
      await request(app.getHttpServer())
        .patch(`/appointments/${id}/status`)
        .send({ status: 'BOOKED' })
        .expect(400);
      await request(app.getHttpServer())
        .post(`/appointments/${id}/cancellation`)
        .expect(409);
    },
  );
  test('R5: history explains derived eligibility across pages, acknowledgement and expiry', async () => {
    for (const startsAt of ['2026-10-19T03:30:00Z', '2026-10-19T03:45:00Z']) {
      const id = idOf(
        await request(app.getHttpServer())
          .post('/appointments')
          .send(booking({ startsAt }))
          .expect(201),
      );
      await request(app.getHttpServer())
        .post(`/appointments/${id}/cancellation`)
        .expect(200);
    }
    const history = body(
      await request(app.getHttpServer())
        .get(`/patients/${patientId}/history`)
        .query({ limit: 1 })
        .expect(200),
    );
    expect(items(history.items)).toHaveLength(1);
    expect(history.total).toBe(2);
    expect(history.deposit).toMatchObject({
      required: true,
      penaltyCount: 2,
      asOf: now,
    });
    expect(
      body(
        await request(app.getHttpServer())
          .post('/appointments')
          .send(booking({ startsAt: '2026-10-19T04:00:00Z' }))
          .expect(409),
      ).code,
    ).toBe('DEPOSIT_REQUIRED');
    expect(
      body(
        await request(app.getHttpServer())
          .post('/appointments')
          .send(
            booking({
              startsAt: '2026-10-19T04:00:00Z',
              depositAcknowledged: true,
            }),
          )
          .expect(201),
      ).depositAcknowledgedAt,
    ).toBe(now);
    const expired = body(
      await request(app.getHttpServer())
        .get(`/patients/${patientId}/history`)
        .set('X-Review-Now', '2026-11-19T03:00:00Z')
        .expect(200),
    );
    expect(expired.deposit).toMatchObject({ required: false, penaltyCount: 0 });
    expect(JSON.stringify(history.deposit)).toContain('acknowledgement');
  });
});

describe('M3 — request clocks, logging, safe failures and OpenAPI', () => {
  test.each([
    '2026-10-19T03:00:00',
    '2026-02-30T03:00:00Z',
    '2026-10-19T24:00:00Z',
    '2026-10-19T03:00:00+05:60',
    '',
  ])('reject malformed reviewer override %s', async (override) => {
    const response = await request(app.getHttpServer())
      .get(`/patients/${patientId}/history`)
      .set('X-Review-Now', override)
      .expect(400);
    expect(body(response)).toMatchObject({ code: 'INVALID_DOMAIN_VALUE' });
  });
  test('deny overrides on every controller when review mode is disabled', async () => {
    const normal = await createApp(false);
    try {
      expect(
        body(
          await request(normal.getHttpServer())
            .get(`/doctors/${doctorId}`)
            .set('X-Review-Now', now)
            .expect(403),
        ).code,
      ).toBe('CLOCK_OVERRIDE_DISABLED');
      await request(normal.getHttpServer())
        .get(`/doctors/${doctorId}`)
        .expect(200);
    } finally {
      await normal.close();
    }
  });
  test('isolate parallel overrides and capture underlying time once per request', async () => {
    const first = '2026-10-19T03:00:00.000Z';
    const second = '2026-11-19T03:00:00.000Z';
    const responses = await Promise.all([
      request(app.getHttpServer())
        .get(`/patients/${patientId}/history`)
        .set('X-Review-Now', first),
      request(app.getHttpServer())
        .get(`/patients/${patientId}/history`)
        .set('X-Review-Now', second),
    ]);
    expect(object(body(responses[0]).deposit).asOf).toBe(first);
    expect(object(body(responses[1]).deposit).asOf).toBe(second);
    expect(
      object(
        body(
          await request(app.getHttpServer())
            .get(`/patients/${patientId}/history`)
            .expect(200),
        ).deposit,
      ).asOf,
    ).toBe(now);
    systemClock.now.mockClear();
    await request(app.getHttpServer())
      .post('/appointments')
      .send(booking())
      .expect(201);
    expect(systemClock.now).toHaveBeenCalledTimes(1);
  });
  test('one correlated JSON record per request, with route templates and no personal/request data', async () => {
    const response = await request(app.getHttpServer())
      .get('/patients/lookup')
      .query({ phone: '+12025550150' })
      .expect(200);
    const requestId: unknown = response.headers['x-request-id'];
    expect(typeof requestId).toBe('string');
    const records = logs.filter((log) => log.requestId === requestId);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      operation: 'GET /patients/lookup',
      level: 'info',
      status: 200,
    });
    expect(records[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(JSON.stringify(logs)).not.toContain('+12025550150');
    expect(JSON.stringify(logs)).not.toContain('Fictional API');
    expect(JSON.stringify(logs)).not.toContain('2000-01-01');
    const invalid = await request(app.getHttpServer())
      .post('/appointments')
      .send(
        booking({
          privateNote: 'secret-request-body',
          startsAt: '2026-10-19T03:31:00Z',
        }),
      )
      .expect(400);
    const rid: unknown = invalid.headers['x-request-id'];
    expect(body(invalid).requestId).toBe(rid);
    expect(logs.find((log) => log.requestId === rid)).toMatchObject({
      level: 'warn',
      code: 'VALIDATION_FAILED',
    });
    expect(JSON.stringify(logs)).not.toContain('secret-request-body');
  });
  test('unexpected/database failures produce a safe 500 and exactly one error log without exception text', async () => {
    const secret = 'private-db-url-and-phone-+12025550150';
    jest
      .spyOn(app.get(AppointmentReader), 'get')
      .mockRejectedValueOnce(new Error(secret));
    const response = await request(app.getHttpServer())
      .get(`/appointments/${randomUUID()}`)
      .expect(500);
    expect(body(response)).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
    expect(JSON.stringify(body(response))).not.toContain(secret);
    const rid: unknown = response.headers['x-request-id'];
    const records = logs.filter((log) => log.requestId === rid);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      level: 'error',
      code: 'INTERNAL_ERROR',
      operation: 'GET /appointments/:id',
    });
    expect(JSON.stringify(logs)).not.toContain(secret);
  });
  test('document all core operations, validation fields, response schemas and reviewer header', async () => {
    const response = body(
      await request(app.getHttpServer()).get('/docs-json').expect(200),
    );
    expect(response.openapi).toBe('3.0.0');
    const paths = object(response.paths);
    for (const path of [
      '/doctors',
      '/doctors/{id}',
      '/patients',
      '/patients/lookup',
      '/patients/{id}/history',
      '/doctors/{doctorId}/slots',
      '/doctors/{doctorId}/availability',
      '/doctors/{doctorId}/availability/weekly/{weekday}',
      '/doctors/{doctorId}/availability/overrides/{date}',
      '/appointments',
      '/appointments/{id}/cancellation',
      '/appointments/{id}/reschedules',
      '/appointments/{id}/status',
    ])
      expect(paths).toHaveProperty(path);
    const schemas = object(object(response.components).schemas);
    expect(schemas).toHaveProperty('ErrorResponse');
    expect(schemas).toHaveProperty('PatientHistoryResponse');
    const parameters = items(
      object(object(paths['/appointments']).post).parameters,
    );
    expect(
      parameters.some((value) => object(value).name === 'X-Review-Now'),
    ).toBe(true);
    await request(app.getHttpServer()).get('/docs/').expect(200);
  });
});
