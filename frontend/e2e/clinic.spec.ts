import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { record, string } from "../src/api/decode";
import { clinicDate, shiftDate, time } from "../src/shared/time";

const apiOrigin = "http://127.0.0.1:3011";
const reviewNow = "2026-10-20T09:00:00+05:30";
const headers = { "X-Review-Now": reviewNow };
let doctorA = "";
let doctorB = "";
let phoneSequence = 10;
const doctorName = "Dr Ananya Rao";
const otherDoctorName = "Dr Vikram Sen";
async function post(
  request: APIRequestContext,
  path: string,
  data: unknown,
  clock = reviewNow,
) {
  const response = await request.post(`${apiOrigin}${path}`, {
    data,
    headers: { "X-Review-Now": clock },
  });
  expect(
    response.ok(),
    `API fixture ${path}: ${response.status()}`,
  ).toBeTruthy();
  const value: unknown = await response.json();
  return record(value);
}
async function patient(
  request: APIRequestContext,
  name = "Fictional Mira Das",
  flags: readonly string[] = [],
) {
  const phone = `+1202555${String(test.info().workerIndex).padStart(2, "0")}${String(phoneSequence++).padStart(4, "0")}`;
  const result = await post(request, "/patients", {
    name,
    phone,
    dateOfBirth: "1994-03-15",
    flags,
  });
  return { id: string(result.id), phone, name };
}
async function book(
  request: APIRequestContext,
  patientId: string,
  doctorId: string,
  date: string,
  start = "09:00",
  clock = reviewNow,
) {
  return post(
    request,
    "/appointments",
    {
      patientId,
      doctorId,
      startsAt: `${date}T${start}:00+05:30`,
      reason: "Fictional UI verification visit",
      depositAcknowledged: true,
    },
    clock,
  );
}
async function getAppointment(request: APIRequestContext, id: string) {
  const response = await request.get(`${apiOrigin}/appointments/${id}`, {
    headers,
  });
  expect(response.ok()).toBeTruthy();
  const value: unknown = await response.json();
  return record(value);
}
async function applyClock(page: Page, value = reviewNow) {
  await page.getByText("Reviewer clock", { exact: true }).click();
  await page.getByLabel("Review instant with timezone").fill(value);
  await page
    .getByRole("button", { name: "Apply reviewer time", exact: true })
    .click();
  await expect(
    page.getByText("Reviewer time is active", { exact: true }),
  ).toBeVisible();
  await page.getByText("Reviewer clock", { exact: true }).click();
}
async function scheduleDate(page: Page, date: string) {
  if (
    (await page
      .getByLabel("Schedule date (IST)", { exact: true })
      .inputValue()) === date
  ) {
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
  }
  await page.getByLabel("Schedule date (IST)", { exact: true }).fill(date);
  await expect(
    page.getByRole("region", { name: `${doctorName} schedule`, exact: true }),
  ).toBeVisible();
}
async function findInDialog(page: Page, phone: string) {
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: /Patient phone number/ })
    .fill(phone);
  await dialog
    .getByRole("button", { name: "Find patient", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Use this patient", exact: true })
    .click();
}
async function openSlot(page: Page, date: string, start = "09:00") {
  await scheduleDate(page, date);
  await page
    .getByRole("button", {
      name: `Book ${doctorName} at ${start}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Book an appointment" }),
  ).toBeVisible();
}

test.beforeAll(async ({ request }) => {
  const existing = record(
    await (
      await request.get(`${apiOrigin}/doctors?limit=100`, { headers })
    ).json(),
  );
  const items = Array.isArray(existing.items) ? existing.items.map(record) : [];
  const a = items.find((item) => item.name === doctorName);
  const b = items.find((item) => item.name === otherDoctorName);
  doctorA = a
    ? string(a.id)
    : string(
        (
          await post(request, "/doctors", {
            name: doctorName,
            speciality: "General medicine",
            slotMinutes: 15,
            dailyCap: 16,
            active: true,
          })
        ).id,
      );
  doctorB = b
    ? string(b.id)
    : string(
        (
          await post(request, "/doctors", {
            name: otherDoctorName,
            speciality: "Family medicine",
            slotMinutes: 30,
            dailyCap: 8,
            active: true,
          })
        ).id,
      );
  for (const id of [doctorA, doctorB]) {
    for (let weekday = 1; weekday <= 7; weekday++) {
      const response = await request.put(
        `${apiOrigin}/doctors/${id}/availability/weekly/${weekday}`,
        { headers, data: { windows: [{ startMinute: 480, endMinute: 720 }] } },
      );
      expect(response.status()).toBe(204);
    }
  }
});
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Appointments & scheduling",
      exact: true,
    }),
  ).toBeVisible();
  await applyClock(page);
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
});

test("IST date and time utilities handle UTC midnight and leap boundaries", () => {
  expect(clinicDate("2026-12-31T20:00:00Z")).toBe("2027-01-01");
  expect(time("2026-12-31T20:00:00Z")).toBe("01:30");
  expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
  expect(shiftDate("2028-02-29", 1)).toBe("2028-03-01");
});

test("day grid uses real 15/30-minute slots, filters doctors and navigates IST dates", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await scheduleDate(page, "2026-10-21");
  await expect(
    page.getByRole("region", { name: `${doctorName} schedule`, exact: true }),
  ).toContainText("15-minute visits");
  await expect(
    page.getByRole("region", {
      name: `${otherDoctorName} schedule`,
      exact: true,
    }),
  ).toContainText("30-minute visits");
  await expect(
    page.getByRole("button", {
      name: `Book ${doctorName} at 08:15`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: `Book ${otherDoctorName} at 08:30`,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Filter schedule by doctor", exact: true })
    .selectOption(doctorB);
  await expect(
    page.getByRole("region", { name: `${doctorName} schedule`, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(
    page.getByLabel("Schedule date (IST)", { exact: true }),
  ).toHaveValue("2026-10-22");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(
    page.getByLabel("Schedule date (IST)", { exact: true }),
  ).toHaveValue("2026-10-20");
  expect(errors).toEqual([]);
});

test("books a valid slot after phone lookup and preserves its real API history", async ({
  page,
  request,
}) => {
  const person = await patient(request);
  await openSlot(page, "2026-10-22");
  const booking = page.getByRole("dialog");
  await expect(
    booking.getByRole("region", { name: "Selected appointment slot" }),
  ).toContainText("09:00–09:15 IST");
  await expect(booking.getByRole("combobox")).toHaveCount(0);
  await expect(booking.locator('input[type="date"]')).toHaveCount(0);
  await findInDialog(page, person.phone);
  await expect(booking.getByRole("checkbox")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Reason for visit", exact: true })
    .fill("Fictional annual checkup");
  await page.screenshot({ path: "test-results/quick-booking-desktop.png" });
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Appointment booked successfully." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `View ${person.name} at 09:00`, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Fictional annual checkup",
  );
  await page.getByText("Status history · 1 events", { exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Booked", { exact: true }),
  ).toHaveCount(2);
});

test("registers a patient from booking with assistance flags and rejects duplicate phones", async ({
  page,
  request,
}) => {
  const existing = await patient(request, "Fictional Existing Patient");
  await openSlot(page, "2026-10-23");
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Register patient", exact: true })
    .click();
  await dialog
    .getByLabel("Full name", { exact: true })
    .fill("Fictional New Patient");
  await dialog.getByLabel("Phone with country code").fill(existing.phone);
  await dialog.getByLabel("Date of birth").fill("2000-02-29");
  await dialog.getByLabel("Interpreter required", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Register patient", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("PHONE_ALREADY_EXISTS");
  await expect(dialog.getByLabel("Full name", { exact: true })).toHaveValue(
    "Fictional New Patient",
  );
  await dialog
    .getByLabel("Phone with country code")
    .fill(
      `+1202555${String(test.info().workerIndex).padStart(2, "0")}${String(phoneSequence++).padStart(4, "0")}`,
    );
  await dialog
    .getByRole("button", { name: "Register patient", exact: true })
    .click();
  await expect(
    dialog.getByText("Interpreter required", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Reason for visit", exact: true })
    .fill("Fictional first visit");
  await dialog
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "View Fictional New Patient at 09:00",
      exact: true,
    }),
  ).toBeVisible();
});

test("explains recent penalties and requires acknowledgement before flagged booking", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Penalty Case", [
    "MOBILITY_ASSISTANCE",
  ]);
  for (const start of ["08:00", "08:15"]) {
    const visit = await book(
      request,
      person.id,
      doctorA,
      "2026-10-19",
      start,
      "2026-10-18T09:00:00+05:30",
    );
    const result = await request.patch(
      `${apiOrigin}/appointments/${string(visit.id)}/status`,
      { headers, data: { status: "NO_SHOW" } },
    );
    expect(result.ok()).toBeTruthy();
  }
  await openSlot(page, "2026-10-24");
  await findInDialog(page, person.phone);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Mobility assistance", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Deposit acknowledgement required", { exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText("2 late cancellations / no-shows");
  await dialog
    .getByRole("textbox", { name: "Reason for visit", exact: true })
    .fill("Fictional follow-up");
  await expect(
    dialog.getByRole("button", { name: "Confirm booking", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Deposit acknowledged", { exact: false }).check();
  await dialog
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Patients", exact: true }).click();
  await page
    .getByRole("textbox", { name: /Patient phone number/ })
    .fill(person.phone);
  await page.getByRole("button", { name: "Find patient", exact: true }).click();
  await page
    .getByRole("button", { name: "Use this patient", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Patient record", exact: true }),
  ).toContainText("3 appointments");
  await expect(
    page
      .getByRole("region", { name: "Patient record", exact: true })
      .locator(".history-item > .section-heading")
      .getByText("No-show", { exact: true }),
  ).toHaveCount(2);
});

test("a stale slot conflict keeps patient and reason while refreshing free slots", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Conflict Patient");
  const winner = await patient(request, "Fictional Winning Patient");
  await openSlot(page, "2026-10-25");
  await findInDialog(page, person.phone);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Reason for visit", exact: true })
    .fill("Keep this reason after a conflict");
  await book(request, winner.id, doctorA, "2026-10-25");
  await dialog
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("DOCTOR_OVERLAP");
  await expect(
    dialog.getByRole("textbox", { name: "Reason for visit", exact: true }),
  ).toHaveValue("Keep this reason after a conflict");
  await expect(dialog.getByText(person.name, { exact: true })).toBeVisible();
  await expect(
    dialog
      .getByRole("status")
      .filter({ hasText: "This slot is no longer available" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Confirm booking", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Choose another slot", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Book ${doctorName} at 09:15`, exact: true })
    .click();
  await expect(dialog.getByText(person.name, { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Reason for visit", exact: true }),
  ).toHaveValue("Keep this reason after a conflict");
  await dialog
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("invalid reschedule preserves the original, then valid reschedule links history", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Reschedule Patient");
  const original = await book(
    request,
    person.id,
    doctorA,
    "2026-10-26",
    "10:00",
  );
  await book(request, person.id, doctorB, "2026-10-26", "09:00");
  await scheduleDate(page, "2026-10-26");
  await page
    .getByRole("button", { name: `View ${person.name} at 10:00`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move appointment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: `Move to ${doctorName} at 09:00`,
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Confirm appointment move",
    exact: true,
  });
  await expect(dialog.getByText(person.name, { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: "Continue with this patient",
      exact: true,
    }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Confirm move", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("PATIENT_OVERLAP");
  expect((await getAppointment(request, string(original.id))).status).toBe(
    "BOOKED",
  );
  await dialog
    .getByRole("button", { name: "Choose another slot", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: `Move to ${doctorName} at 11:00`,
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: "Confirm move", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await getAppointment(request, string(original.id))).status).toBe(
    "CANCELLED",
  );
  await page
    .getByRole("button", { name: `View ${person.name} at 11:00`, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(string(original.id));
});

test("cancel confirmation preserves history and reflects the API cancellation status", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Cancel Patient");
  const visit = await book(request, person.id, doctorA, "2026-10-27");
  await scheduleDate(page, "2026-10-27");
  await page
    .getByRole("button", { name: `View ${person.name} at 09:00`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel appointment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep appointment", exact: true })
    .click();
  expect((await getAppointment(request, string(visit.id))).status).toBe(
    "BOOKED",
  );
  await page
    .getByRole("button", { name: "Cancel appointment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Yes, cancel appointment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await getAppointment(request, string(visit.id))).status).toBe(
    "CANCELLED",
  );
  await expect(
    page.getByRole("button", {
      name: `Book ${doctorName} at 09:00`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText("1 cancelled appointment", { exact: true }).click();
  await expect(
    page
      .getByRole("button", { name: `${person.name}`, exact: false })
      .filter({ hasText: "Cancelled" }),
  ).toBeVisible();
});

test("today queue completes and marks no-show only after appointment end", async ({
  page,
  request,
}) => {
  const completed = await patient(request, "Fictional Queue Completed");
  const absent = await patient(request, "Fictional Queue Absent");
  const first = await book(
    request,
    completed.id,
    doctorA,
    "2026-10-20",
    "08:00",
    "2026-10-19T09:00:00+05:30",
  );
  const second = await book(
    request,
    absent.id,
    doctorA,
    "2026-10-20",
    "08:15",
    "2026-10-19T09:00:00+05:30",
  );
  await page
    .getByRole("button", { name: "Today’s queue", exact: true })
    .click();
  await page.getByRole("button").filter({ hasText: completed.name }).click();
  await page
    .getByRole("button", { name: "Mark completed", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button").filter({ hasText: absent.name }).click();
  await page.getByRole("button", { name: "Mark no-show", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await getAppointment(request, string(first.id))).status).toBe(
    "COMPLETED",
  );
  expect((await getAppointment(request, string(second.id))).status).toBe(
    "NO_SHOW",
  );
  await page
    .getByLabel("Include completed and no-shows", { exact: true })
    .check();
  await expect(
    page.getByRole("button").filter({ hasText: completed.name }),
  ).toContainText("Completed");
  await expect(
    page.getByRole("button").filter({ hasText: absent.name }),
  ).toContainText("No-show");
});

test("patient phone search has empty states, edit profile and page-independent penalties", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional History Patient");
  for (let i = 0; i < 21; i++)
    await book(request, person.id, doctorA, shiftDate("2026-10-28", i));
  await page.getByRole("button", { name: "Patients", exact: true }).click();
  await page
    .getByRole("textbox", { name: /Patient phone number/ })
    .fill("+12025559999");
  await page.getByRole("button", { name: "Find patient", exact: true }).click();
  await expect(
    page.getByText("No patient found", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: /Patient phone number/ })
    .fill(person.phone);
  await page.getByRole("button", { name: "Find patient", exact: true }).click();
  await page
    .getByRole("button", { name: "Use this patient", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Patient record",
    exact: true,
  });
  await expect(panel).toContainText("1–20 of 21");
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  await expect(panel).toContainText("21–21 of 21");
  await panel
    .getByRole("button", { name: "Edit profile", exact: true })
    .click();
  await panel
    .getByLabel("Full name", { exact: true })
    .fill("Fictional Updated Profile");
  await panel.getByLabel("Mobility assistance", { exact: true }).check();
  await panel
    .getByRole("button", { name: "Save patient", exact: true })
    .click();
  await expect(
    panel.getByText("Fictional Updated Profile", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Mobility assistance", { exact: true }),
  ).toBeVisible();
});

test("availability edits expose occupied conflicts, leave overrides and explicit restore", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Availability Patient");
  const visit = await book(request, person.id, doctorA, "2026-11-20");
  await page
    .getByRole("button", { name: "Clinic settings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Availability type", exact: true })
    .selectOption("override");
  await page
    .getByLabel("Override date (IST)", { exact: true })
    .fill("2026-11-20");
  await page
    .getByLabel("Reason for override", { exact: true })
    .fill("Fictional leave test");
  await page
    .getByRole("button", { name: "Save date override", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("SCHEDULE_CONFLICT");
  await page
    .getByText("Affected appointment references", { exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(string(visit.id));
  await page
    .getByLabel("Override date (IST)", { exact: true })
    .fill("2026-11-21");
  await page
    .getByRole("button", { name: "Save date override", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Whole-day override saved." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restore weekly hours", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await scheduleDate(page, "2026-11-21");
  await expect(
    page.getByRole("region", { name: `${doctorName} schedule`, exact: true }),
  ).toContainText("No bookable slots");
  await page
    .getByRole("button", { name: "Clinic settings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Availability type", exact: true })
    .selectOption("override");
  await page
    .getByLabel("Override date (IST)", { exact: true })
    .fill("2026-11-21");
  await page
    .getByRole("button", { name: "Restore weekly hours", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Date override removed" }),
  ).toBeVisible();
});

test("doctor registration and settings use validated real API calls", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Clinic settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Add doctor", exact: false }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Doctor name", { exact: true })
    .fill("Dr Fictional UI Doctor");
  await dialog
    .getByLabel("Speciality", { exact: true })
    .fill("Fictional test speciality");
  await dialog
    .getByRole("combobox", { name: "Slot length", exact: true })
    .selectOption("30");
  await dialog.getByLabel("Daily appointment cap", { exact: true }).fill("4");
  await dialog
    .getByRole("button", { name: "Save doctor", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const item = page
    .locator(".directory-item")
    .filter({ hasText: "Dr Fictional UI Doctor" });
  await item.locator(".directory-select").click();
  await page
    .getByRole("combobox", { name: "Weekday", exact: true })
    .selectOption("1");
  await page
    .getByRole("button", { name: "Add working window", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Save weekly hours", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Weekly hours updated." }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Availability type", exact: true })
    .selectOption("override");
  await page
    .getByLabel("Override date (IST)", { exact: true })
    .fill("2026-10-25");
  await page
    .getByRole("button", { name: "Add working window", exact: false })
    .click();
  await page
    .getByLabel("Reason for override", { exact: true })
    .fill("Fictional extra Sunday clinic");
  await page
    .getByRole("button", { name: "Save date override", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Whole-day override saved." }),
  ).toBeVisible();
  await item.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Active in booking", { exact: true })
    .uncheck();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save doctor", exact: true })
    .click();
  await expect(item).toContainText("Inactive");
});

test("phone viewport has no horizontal overflow and native dialog supports keyboard close", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Phone Patient");
  await page.setViewportSize({ width: 375, height: 812 });
  await openSlot(page, "2026-11-22");
  await findInDialog(page, person.phone);
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    elements: Array.from(document.querySelectorAll("body *"))
      .map((el) => ({
        tag: el.tagName,
        class: el.className,
        right: Math.round(el.getBoundingClientRect().right),
        width: Math.round(el.getBoundingClientRect().width),
      }))
      .filter((el) => el.right > window.innerWidth && el.width > 0)
      .slice(0, 20),
  }));
  expect(overflow.width, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.viewport,
  );
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Reason for visit", exact: true })
    .fill("Fictional phone-width booking");
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: `View ${person.name} at 09:00`, exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: `View ${person.name} at 09:00`,
      exact: true,
    }),
  ).toBeFocused();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/m4-phone.png", fullPage: true });
});

test("API outage shows an actionable error and reconnects without mock patient data", async ({
  page,
}) => {
  await page.route(`${apiOrigin}/doctors?*`, (route) => route.abort("failed"));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Could not reach the clinic API",
  );
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await page.unroute(`${apiOrigin}/doctors?*`);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Appointments & scheduling" }),
  ).toBeVisible();
});

test("invalid reviewer time is explained and actual header rejection can be cleared", async ({
  page,
}) => {
  await page.getByText("Reviewer clock", { exact: true }).click();
  await page
    .getByLabel("Review instant with timezone")
    .fill("2026-10-20T09:00");
  await page
    .getByRole("button", { name: "Apply reviewer time", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Enter a timestamp with a timezone",
  );
  await page
    .getByLabel("Review instant with timezone")
    .fill("2026-02-30T09:00:00+05:30");
  await page
    .getByRole("button", { name: "Apply reviewer time", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("INVALID_DOMAIN_VALUE");
  await page
    .getByRole("button", { name: "Use real time", exact: true })
    .click();
  await expect(
    page.getByText("Reviewer time is active", { exact: true }),
  ).toHaveCount(0);
});

test("desktop layout renders the real grid without overflow in a non-IST browser timezone", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await scheduleDate(page, "2026-10-22");
  await expect(
    page.getByRole("button", {
      name: `Book ${doctorName} at 09:15`,
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/m4-desktop.png",
    fullPage: true,
  });
});

test("loading state waits for actual API data without showing stale slots", async ({
  page,
}) => {
  await expect(
    page.getByRole("region", { name: `${doctorName} schedule`, exact: true }),
  ).toBeVisible();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `${apiOrigin}/appointments?*date=2026-11-25*`,
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  await page
    .getByLabel("Schedule date (IST)", { exact: true })
    .fill("2026-11-25");
  try {
    await expect(
      page.getByRole("status").filter({ hasText: "Loading doctor schedules" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Book ${doctorName} at 09:00`,
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", {
      name: `Book ${doctorName} at 09:00`,
      exact: true,
    }),
  ).toBeVisible();
});

test("late cancellation uses the API status and patient eligibility expires with reviewer time", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Late Cancellation");
  const visit = await book(request, person.id, doctorA, "2026-10-20", "10:00");
  await scheduleDate(page, "2026-10-20");
  await page
    .getByRole("button", { name: `View ${person.name} at 10:00`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel appointment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Yes, cancel appointment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await getAppointment(request, string(visit.id))).status).toBe(
    "LATE_CANCELLED",
  );
  await page.getByRole("button", { name: "Patients", exact: true }).click();
  await page
    .getByRole("textbox", { name: /Patient phone number/ })
    .fill(person.phone);
  await page.getByRole("button", { name: "Find patient", exact: true }).click();
  await page
    .getByRole("button", { name: "Use this patient", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Patient record",
    exact: true,
  });
  await expect(panel).toContainText("1 late cancellation / no-show");
  await applyClock(page, "2026-11-20T09:00:00+05:30");
  await page
    .getByRole("textbox", { name: /Patient phone number/ })
    .fill(person.phone);
  await page.getByRole("button", { name: "Find patient", exact: true }).click();
  await page
    .getByRole("button", { name: "Use this patient", exact: true })
    .click();
  await expect(panel).toContainText("0 late cancellations / no-shows");
  await expect(
    panel.getByText("Late-cancelled", { exact: true }).first(),
  ).toBeVisible();
});

test("saves loaded weekly hours without sending response-only metadata", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Clinic settings", exact: true })
    .click();
  await expect(page.getByLabel("Start (IST)", { exact: true })).toHaveValue(
    "08:00",
  );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().endsWith(`/doctors/${doctorA}/availability/weekly/1`),
  );
  await page
    .getByRole("button", { name: "Save weekly hours", exact: true })
    .click();
  const response = await responsePromise;
  const payload: unknown = response.request().postDataJSON();
  expect(response.status(), JSON.stringify(payload)).toBe(204);
  expect(payload).toEqual({ windows: [{ startMinute: 480, endMinute: 720 }] });
  await expect(
    page.getByRole("status").filter({ hasText: "Weekly hours updated." }),
  ).toBeVisible();
});

test("booking button opens the patient and doctor modal", async ({ page }) => {
  await page.getByRole("button", { name: "Patients", exact: true }).click();
  await page
    .getByRole("button", { name: "Book appointment", exact: false })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Book an appointment",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("combobox", { name: "Select doctor", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Choose date & time", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("keyboard move carries patient and reason across days and doctor durations", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Keyboard Move");
  const original = await book(
    request,
    person.id,
    doctorA,
    "2026-11-26",
    "09:15",
  );
  await scheduleDate(page, "2026-11-26");
  await page
    .getByRole("button", { name: `View ${person.name} at 09:15`, exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Move appointment", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Move appointment", exact: true }),
  ).toBeVisible();
  await scheduleDate(page, "2026-11-27");
  const target = page.getByRole("button", {
    name: `Move to ${otherDoctorName} at 10:30`,
    exact: true,
  });
  await target.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Confirm appointment move" });
  await expect(dialog.getByText(person.name, { exact: true })).toBeVisible();
  await expect(dialog).toContainText("10:30–11:00 IST");
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  expect((await getAppointment(request, string(original.id))).status).toBe(
    "BOOKED",
  );
  await dialog
    .getByRole("button", { name: "Confirm move", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await getAppointment(request, string(original.id))).status).toBe(
    "CANCELLED",
  );
  await page
    .getByRole("button", { name: `View ${person.name} at 10:30`, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Fictional UI verification visit",
  );
  await expect(page.getByRole("dialog")).toContainText(string(original.id));
});

test("dragging a booked visit only reschedules after explicit confirmation", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Drag Move");
  const original = await book(request, person.id, doctorA, "2026-11-28");
  await scheduleDate(page, "2026-11-28");
  const source = page.getByRole("button", {
    name: `View ${person.name} at 09:00`,
    exact: true,
  });
  const target = page.getByRole("button", {
    name: `Book ${otherDoctorName} at 10:00`,
    exact: true,
  });
  await source.dragTo(target);
  const dialog = page.getByRole("dialog", { name: "Confirm appointment move" });
  await expect(dialog.getByText(person.name, { exact: true })).toBeVisible();
  await expect(dialog).toContainText("10:00–10:30 IST");
  expect((await getAppointment(request, string(original.id))).status).toBe(
    "BOOKED",
  );
  await page.screenshot({ path: "test-results/quick-move-desktop.png" });
  await dialog
    .getByRole("button", { name: "Confirm move", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await getAppointment(request, string(original.id))).status).toBe(
    "CANCELLED",
  );
  await expect(
    page.getByRole("button", {
      name: `View ${person.name} at 10:00`,
      exact: true,
    }),
  ).toBeVisible();
});

test("phone tap move and cancellation preserve the original appointment", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Phone Move");
  const original = await book(
    request,
    person.id,
    doctorB,
    "2026-11-29",
    "09:30",
  );
  const baseline = await getAppointment(request, string(original.id));
  await page.setViewportSize({ width: 375, height: 812 });
  await scheduleDate(page, "2026-11-29");
  await page
    .getByRole("button", { name: `View ${person.name} at 09:30`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move appointment", exact: true })
    .click();
  await scheduleDate(page, "2026-11-30");
  await page
    .getByRole("button", {
      name: `Move to ${doctorName} at 10:45`,
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", { name: "Confirm appointment move" });
  await expect(dialog.getByText(person.name, { exact: true })).toBeVisible();
  await expect(dialog).toContainText("10:45–11:00 IST");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/quick-move-phone.png" });
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Cancel move", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Move appointment", exact: true }),
  ).toHaveCount(0);
  const unchanged = await getAppointment(request, string(original.id));
  expect(unchanged.status).toBe("BOOKED");
  expect(unchanged.startsAt).toBe(original.startsAt);
  expect(unchanged.reason).toBe(original.reason);
  expect(unchanged.events).toEqual(baseline.events);
});

test("late move reveals deposit acknowledgement when the API requires it", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Late Move");
  const penalty = await book(
    request,
    person.id,
    doctorB,
    "2026-10-18",
    "08:00",
    "2026-10-17T09:00:00+05:30",
  );
  const noShow = await request.patch(
    `${apiOrigin}/appointments/${string(penalty.id)}/status`,
    { headers, data: { status: "NO_SHOW" } },
  );
  expect(noShow.ok()).toBeTruthy();
  const original = await book(
    request,
    person.id,
    doctorA,
    "2026-10-20",
    "10:30",
  );
  await page
    .getByRole("button", { name: "Today’s queue", exact: true })
    .click();
  await page.getByRole("button").filter({ hasText: person.name }).click();
  await page
    .getByRole("button", { name: "Move appointment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A well-planned day." }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: `Move to ${doctorName} at 11:00`,
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", { name: "Confirm appointment move" });
  await expect(dialog.getByText(person.name, { exact: true })).toBeVisible();
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Confirm move", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("DEPOSIT_REQUIRED");
  expect((await getAppointment(request, string(original.id))).status).toBe(
    "BOOKED",
  );
  await expect(
    dialog.getByRole("button", { name: "Confirm move", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Deposit acknowledged", { exact: false }).check();
  await dialog
    .getByRole("button", { name: "Confirm move", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await getAppointment(request, string(original.id))).status).toBe(
    "LATE_CANCELLED",
  );
});

test("dashboard calendar and status filters show actual appointment lifecycle states", async ({
  page,
  request,
}) => {
  const entries = [
    { name: "Fictional Dashboard Booked", start: "11:00", state: "BOOKED" },
    {
      name: "Fictional Dashboard Completed",
      start: "08:00",
      state: "COMPLETED",
    },
    {
      name: "Fictional Dashboard Cancelled",
      start: "08:15",
      state: "CANCELLED",
    },
    {
      name: "Fictional Dashboard Late",
      start: "09:00",
      state: "LATE_CANCELLED",
    },
    { name: "Fictional Dashboard Absent", start: "08:30", state: "NO_SHOW" },
  ];
  for (const entry of entries) {
    const person = await patient(request, entry.name);
    const visit = await book(
      request,
      person.id,
      doctorA,
      "2026-12-05",
      entry.start,
    );
    if (entry.state === "COMPLETED" || entry.state === "NO_SHOW") {
      const result = await request.patch(
        `${apiOrigin}/appointments/${string(visit.id)}/status`,
        {
          headers: { "X-Review-Now": "2026-12-05T12:00:00+05:30" },
          data: { status: entry.state },
        },
      );
      expect(result.ok()).toBeTruthy();
    } else if (
      entry.state === "CANCELLED" ||
      entry.state === "LATE_CANCELLED"
    ) {
      await post(
        request,
        `/appointments/${string(visit.id)}/cancellation`,
        undefined,
        entry.state === "LATE_CANCELLED"
          ? "2026-12-05T08:00:00+05:30"
          : reviewNow,
      );
    }
  }
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page
    .getByLabel("Dashboard date (IST)", { exact: true })
    .fill("2026-12-05");
  const panel = page.getByRole("region", {
    name: "Appointments for selected date",
    exact: true,
  });
  await expect(panel.locator(".appointment-row")).toHaveCount(5);
  await expect(panel).toContainText("Late-cancelled");
  await expect(page.locator(".dashboard-stats")).toContainText("5");
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await panel.getByRole("button", { name: "Cancelled", exact: true }).click();
  await expect(panel.locator(".appointment-row")).toHaveCount(2);
  await panel
    .getByRole("button", { name: "All appointments", exact: true })
    .click();
  await page
    .getByLabel("Search appointment patient or reason", { exact: true })
    .fill("Dashboard Absent");
  await expect(panel.locator(".appointment-row")).toHaveCount(1);
  await expect(panel).toContainText("No-show");
  await page
    .getByLabel("Search appointment patient or reason", { exact: true })
    .fill("");
  await page
    .getByRole("button", { name: "Sunday, 6 December 2026", exact: true })
    .click();
  await expect(
    page.getByLabel("Dashboard date (IST)", { exact: true }),
  ).toHaveValue("2026-12-06");
  await expect(panel).toContainText("A little room in the day");
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Appointment calendar", exact: true }),
  ).toContainText("November 2026");
  await page.getByRole("button", { name: "Go to today", exact: true }).click();
  await expect(
    page.getByLabel("Dashboard date (IST)", { exact: true }),
  ).toHaveValue("2026-10-20");
});

test("booking modal chooses patient doctor date and live time chips before saving", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Visual Booking");
  const occupiedPerson = await patient(request, "Fictional Occupied Time");
  await book(request, occupiedPerson.id, doctorB, "2026-12-09", "10:00");
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page
    .getByLabel("Dashboard date (IST)", { exact: true })
    .fill("2026-12-07");
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  await findInDialog(page, person.phone);
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Select doctor", exact: true })
    .selectOption(doctorB);
  await page
    .getByRole("button", { name: "Choose date & time", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Pick a date and time",
    exact: true,
  });
  await picker
    .getByLabel("Booking date (IST)", { exact: true })
    .fill("2026-12-09");
  await expect(
    picker.getByRole("button", { name: "10:00 IST — occupied", exact: true }),
  ).toBeDisabled();
  await picker.getByRole("button", { name: "10:30 IST", exact: true }).click();
  await page.screenshot({ path: "test-results/booking-picker-desktop.png" });
  await picker.getByRole("button", { name: "Continue", exact: true }).click();
  const review = page.getByRole("dialog", {
    name: "Book an appointment",
    exact: true,
  });
  await expect(review).toContainText(person.name);
  await expect(review).toContainText("10:30–11:00 IST");
  await review
    .getByRole("textbox", { name: "Reason for visit", exact: true })
    .fill("Fictional visual picker booking");
  await review
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByLabel("Dashboard date (IST)", { exact: true }),
  ).toHaveValue("2026-12-09");
  await expect(
    page.getByRole("region", {
      name: "Appointments for selected date",
      exact: true,
    }),
  ).toContainText(person.name);
});

test("booking picker handles empty days and phone widths without losing the patient", async ({
  page,
  request,
}) => {
  const person = await patient(request, "Fictional Picker Phone");
  const leave = await request.put(
    `${apiOrigin}/doctors/${doctorB}/availability/overrides/2026-12-08`,
    { headers, data: { reason: "Fictional leave", windows: [] } },
  );
  expect(leave.status()).toBe(204);
  await page.setViewportSize({ width: 375, height: 812 });
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  await findInDialog(page, person.phone);
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Select doctor", exact: true })
    .selectOption(doctorB);
  await page
    .getByRole("button", { name: "Choose date & time", exact: true })
    .click();
  const picker = page.getByRole("dialog", {
    name: "Pick a date and time",
    exact: true,
  });
  await picker
    .getByLabel("Booking date (IST)", { exact: true })
    .fill("2026-12-08");
  await expect(picker).toContainText("No available times");
  await expect(
    picker.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await picker
    .getByRole("button", {
      name: "Choose Thursday, 10 December 2026",
      exact: true,
    })
    .click();
  await picker.getByRole("button", { name: "10:00 IST", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await picker.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/booking-picker-phone.png" });
  await picker.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(person.name);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/dashboard-phone.png",
    fullPage: true,
  });
});
