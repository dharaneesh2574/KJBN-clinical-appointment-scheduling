import { apiBaseUrl } from "../config";
import * as decode from "./decode";
import type {
  AppointmentStatus,
  BookingInput,
  DoctorInput,
  LocalWindow,
  PatientInput,
} from "./types";

function windowInputs(windows: readonly LocalWindow[]): LocalWindow[] {
  return windows.map(({ startMinute, endMinute }) => ({
    startMinute,
    endMinute,
  }));
}

const explanations: Readonly<Record<string, string>> = {
  INVALID_DOMAIN_VALUE:
    "A supplied value is invalid. Check dates, times, identifiers and phone format.",
  DOCTOR_INACTIVE:
    "This doctor is not currently accepting bookings. Choose an active doctor.",
  DOCTOR_OVERLAP: "That time was just taken. Choose another available slot.",
  PATIENT_OVERLAP:
    "This patient already has an overlapping appointment with a doctor.",
  DAILY_CAP_REACHED:
    "This doctor has reached the daily appointment limit. Choose another day.",
  DEPOSIT_REQUIRED:
    "This booking requires deposit acknowledgement. Confirm it below before submitting.",
  OUTSIDE_AVAILABILITY:
    "The slot is no longer within the doctor’s hours. Refresh and choose an available time.",
  OFF_GRID: "Choose a time from the available slots.",
  BOOKING_HORIZON:
    "Choose an available time from now through the next 60 days.",
  SCHEDULE_CONFLICT:
    "This change would invalidate existing appointments. Resolve the listed appointments first.",
  PHONE_ALREADY_EXISTS:
    "This phone already belongs to a patient. Use phone search to find their record.",
  INVALID_TRANSITION:
    "This appointment cannot be changed to that status. Refresh its latest details.",
  CLOCK_OVERRIDE_DISABLED:
    "Reviewer time is disabled on this API. Clear it, or enable REVIEW_MODE on the backend.",
  CONCURRENT_MODIFICATION:
    "The clinic is busy with another change. Refresh the schedule before trying again.",
  VALIDATION_FAILED:
    "Check the form values. Required fields, dates, times and phone numbers must be valid.",
  NOT_FOUND:
    "The requested record was not found. Check the phone number or refresh the list.",
  INTERNAL_ERROR:
    "The clinic could not complete this request. Refresh to check its latest state before retrying.",
};
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;
  readonly appointmentIds: readonly string[];
  constructor(
    code: string,
    status: number,
    requestId: string,
    appointmentIds: readonly string[] = [],
    message?: string,
  ) {
    super(
      explanations[code] ??
        message ??
        "The clinic could not complete this request.",
    );
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.appointmentIds = appointmentIds;
  }
}
export class ClinicApi {
  readonly reviewNow: string;
  constructor(reviewNow = "") {
    this.reviewNow = reviewNow;
  }
  private async request(
    path: string,
    options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
  ): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined)
      headers["Content-Type"] = "application/json";
    if (this.reviewNow) headers["X-Review-Now"] = this.reviewNow;
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
        method: options.method ?? "GET",
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
          : AbortSignal.timeout(20000),
        cache: "no-store",
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new Error(
        "Could not reach the clinic API. Check your connection, then refresh. If you submitted a change, check the schedule before retrying.",
        { cause: error },
      );
    }
    if (response.status === 204) return undefined;
    const value: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const x =
        typeof value === "object" && value !== null && !Array.isArray(value)
          ? value
          : {};
      const code =
        "code" in x && typeof x.code === "string" ? x.code : "REQUEST_FAILED";
      const requestId =
        "requestId" in x && typeof x.requestId === "string"
          ? x.requestId
          : (response.headers.get("X-Request-Id") ?? "");
      const details =
        "details" in x && typeof x.details === "object" && x.details !== null
          ? x.details
          : {};
      const ids =
        "appointmentIds" in details && Array.isArray(details.appointmentIds)
          ? details.appointmentIds.filter(
              (id): id is string => typeof id === "string",
            )
          : [];
      throw new ApiError(code, response.status, requestId, ids);
    }
    return value;
  }
  private async all<T>(
    path: string,
    parse: (value: unknown) => T,
    signal?: AbortSignal,
  ): Promise<readonly T[]> {
    const items: T[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = decode.page(
        await this.request(
          `${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`,
          { signal },
        ),
        parse,
      );
      items.push(...page.items);
      if (items.length >= page.total || page.items.length === 0) return items;
      if (offset >= 1000000)
        throw new Error(
          "Too many records to display. Narrow the selected day.",
        );
    }
  }
  doctors(signal?: AbortSignal) {
    return this.all("/doctors", decode.doctor, signal);
  }
  async saveDoctor(input: DoctorInput, id?: string) {
    const result = await this.request(id ? `/doctors/${id}` : "/doctors", {
      method: id ? "PUT" : "POST",
      body: input,
    });
    return id ? undefined : decode.doctor(result);
  }
  async patient(id: string, signal?: AbortSignal) {
    return decode.patient(await this.request(`/patients/${id}`, { signal }));
  }
  async lookup(phone: string, signal?: AbortSignal) {
    return decode.patient(
      await this.request(`/patients/lookup?${new URLSearchParams({ phone })}`, {
        signal,
      }),
    );
  }
  async savePatient(input: PatientInput, id?: string) {
    return decode.patient(
      await this.request(id ? `/patients/${id}` : "/patients", {
        method: id ? "PUT" : "POST",
        body: input,
      }),
    );
  }
  async history(id: string, offset = 0, signal?: AbortSignal) {
    return decode.history(
      await this.request(`/patients/${id}/history?offset=${offset}&limit=20`, {
        signal,
      }),
    );
  }
  appointments(date: string, signal?: AbortSignal, status?: AppointmentStatus) {
    return this.all(
      `/appointments?${new URLSearchParams({ date, ...(status ? { status } : {}) })}`,
      decode.appointment,
      signal,
    );
  }
  async appointment(id: string, signal?: AbortSignal) {
    return decode.audited(
      await this.request(`/appointments/${id}`, { signal }),
    );
  }
  async slots(doctorId: string, date: string, signal?: AbortSignal) {
    return decode.array(
      await this.request(
        `/doctors/${doctorId}/slots?${new URLSearchParams({ date })}`,
        { signal },
      ),
      decode.slot,
    );
  }
  async book(patientId: string, input: BookingInput) {
    return decode.appointment(
      await this.request("/appointments", {
        method: "POST",
        body: { ...input, patientId },
      }),
    );
  }
  async reschedule(id: string, input: BookingInput) {
    return decode.appointment(
      await this.request(`/appointments/${id}/reschedules`, {
        method: "POST",
        body: input,
      }),
    );
  }
  async cancel(id: string) {
    return decode.appointment(
      await this.request(`/appointments/${id}/cancellation`, {
        method: "POST",
      }),
    );
  }
  async finish(id: string, status: "COMPLETED" | "NO_SHOW") {
    return decode.appointment(
      await this.request(`/appointments/${id}/status`, {
        method: "PATCH",
        body: { status },
      }),
    );
  }
  async availability(
    doctorId: string,
    from: string,
    to: string,
    signal?: AbortSignal,
  ) {
    return decode.availability(
      await this.request(
        `/doctors/${doctorId}/availability?${new URLSearchParams({ from, to })}`,
        { signal },
      ),
    );
  }
  async weekly(
    doctorId: string,
    weekday: number,
    windows: readonly LocalWindow[],
  ) {
    await this.request(`/doctors/${doctorId}/availability/weekly/${weekday}`, {
      method: "PUT",
      body: { windows: windowInputs(windows) },
    });
  }
  async override(
    doctorId: string,
    date: string,
    windows: readonly LocalWindow[],
    reason: string,
  ) {
    await this.request(`/doctors/${doctorId}/availability/overrides/${date}`, {
      method: "PUT",
      body: { windows: windowInputs(windows), reason },
    });
  }
  async removeOverride(doctorId: string, date: string) {
    await this.request(`/doctors/${doctorId}/availability/overrides/${date}`, {
      method: "DELETE",
    });
  }
}
