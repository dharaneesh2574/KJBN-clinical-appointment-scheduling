import { useCallback, useState } from "react";
import {
  ArrowUpRightIcon,
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import type { ClinicApi } from "../../api/client";
import type { Appointment, AppointmentStatus, Doctor } from "../../api/types";
import { clinicDate, dateLabel, shiftDate, time } from "../../shared/time";
import { useResource } from "../../shared/use-resource";
import { Empty, ErrorNotice, Loading, Status } from "../../shared/ui";

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${month}-15T12:00:00+05:30`));
}
function adjacentMonth(month: string, offset: number) {
  const date = new Date(`${month}-15T12:00:00+05:30`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return clinicDate(date.getTime()).slice(0, 7);
}
export function DashboardCalendar({
  date,
  today,
  onDate,
}: {
  date: string;
  today: string;
  onDate: (date: string) => void;
}) {
  const [view, setView] = useState(date.slice(0, 7));
  const first = `${view}-01`;
  const weekday = (new Date(`${first}T12:00:00+05:30`).getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) =>
    shiftDate(first, index - weekday),
  );
  return (
    <section className="dashboard-calendar" aria-label="Appointment calendar">
      <div className="calendar-heading">
        <h3>{monthLabel(view)}</h3>
        <div className="button-row">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous month"
            onClick={() => setView(adjacentMonth(view, -1))}
          >
            <CaretLeftIcon size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Next month"
            onClick={() => setView(adjacentMonth(view, 1))}
          >
            <CaretRightIcon size={15} />
          </button>
        </div>
      </div>
      <div className="month-weekdays" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
          <span key={index}>{day}</span>
        ))}
      </div>
      <div className="month-days">
        {days.map((day) => (
          <button
            type="button"
            key={day}
            aria-label={dateLabel(day, true)}
            aria-pressed={day === date}
            className={`${day.slice(0, 7) !== view ? "outside-month" : ""} ${day === today ? "calendar-today" : ""}`}
            onClick={() => {
              onDate(day);
              if (day.slice(0, 7) !== view) setView(day.slice(0, 7));
            }}
          >
            {Number(day.slice(8))}
          </button>
        ))}
      </div>
      <div className="calendar-footer">
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setView(today.slice(0, 7));
            onDate(today);
          }}
        >
          Go to today
        </button>
        <span className="small-text muted">All times IST</span>
      </div>
      <label className="calendar-jump">
        Jump to date
        <input
          type="date"
          required
          aria-label="Dashboard date (IST)"
          value={date}
          onChange={(event) => {
            if (event.target.value) {
              onDate(event.target.value);
              setView(event.target.value.slice(0, 7));
            }
          }}
        />
      </label>
    </section>
  );
}
const filters: readonly { label: string; value: "ALL" | AppointmentStatus }[] =
  [
    { label: "All appointments", value: "ALL" },
    { label: "Booked", value: "BOOKED" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Cancelled", value: "CANCELLED" },
    { label: "No-show", value: "NO_SHOW" },
  ];
export function Dashboard({
  api,
  doctors,
  date,
  today,
  revision,
  onDate,
  onOpen,
  onBook,
  onRefresh,
}: {
  api: ClinicApi;
  doctors: readonly Doctor[];
  date: string;
  today: string;
  revision: number;
  onDate: (date: string) => void;
  onOpen: (appointment: Appointment) => void;
  onBook: () => void;
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState<"ALL" | AppointmentStatus>("ALL");
  const [doctorId, setDoctorId] = useState("");
  const [search, setSearch] = useState("");
  const load = useCallback(
    async (signal: AbortSignal) => {
      const visits = await api.appointments(date, signal);
      const people = await Promise.all(
        [...new Set(visits.map((visit) => visit.patientId))].map((id) =>
          api.patient(id, signal),
        ),
      );
      return {
        visits,
        patients: new Map(people.map((person) => [person.id, person])),
      };
    },
    [api, date],
  );
  const result = useResource(load, `${api.reviewNow}:${date}:${revision}`);
  const visits = result.data?.visits ?? [];
  const counts = {
    all: visits.length,
    booked: visits.filter((visit) => visit.status === "BOOKED").length,
    completed: visits.filter((visit) => visit.status === "COMPLETED").length,
    cancelled: visits.filter((visit) =>
      ["CANCELLED", "LATE_CANCELLED"].includes(visit.status),
    ).length,
  };
  const summaries = [
    {
      label: "Appointments",
      value: counts.all,
      Icon: CalendarBlankIcon,
      color: "teal",
      note: "For the selected day",
    },
    {
      label: "Booked",
      value: counts.booked,
      Icon: ClockIcon,
      color: "amber",
      note: "Scheduled to be seen",
    },
    {
      label: "Completed",
      value: counts.completed,
      Icon: CheckCircleIcon,
      color: "blue",
      note: "Visits completed",
    },
    {
      label: "Cancelled",
      value: counts.cancelled,
      Icon: XCircleIcon,
      color: "rose",
      note: "Includes late cancellations",
    },
  ];
  const shown = visits
    .filter(
      (visit) =>
        (status === "ALL" ||
          visit.status === status ||
          (status === "CANCELLED" && visit.status === "LATE_CANCELLED")) &&
        (!doctorId || visit.doctorId === doctorId) &&
        (!search.trim() ||
          `${result.data?.patients.get(visit.patientId)?.name ?? ""} ${visit.reason}`
            .toLowerCase()
            .includes(search.trim().toLowerCase())),
    )
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  return (
    <div className="dashboard-layout">
      <div className="dashboard-stats" aria-label="Appointment totals">
        {summaries.map(({ label, value, Icon, color, note }) => (
          <div className="dashboard-stat" key={label}>
            <span className={`summary-icon ${color}`}>
              <Icon size={23} weight="duotone" />
            </span>
            <div>
              <strong>{result.loading || result.error ? "—" : value}</strong>
              <span>{label}</span>
              <small>{note}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-main">
        <section
          className="appointments-panel"
          aria-label="Appointments for selected date"
        >
          <div className="appointments-heading">
            <div>
              <h2>Appointments</h2>
              <p>{dateLabel(date, true)}</p>
            </div>
            <span className="badge neutral">
              {result.loading || result.error
                ? "Loading"
                : `${visits.length} visits`}
            </span>
          </div>
          <div className="appointment-filters">
            <div className="status-tabs" aria-label="Filter appointment status">
              {filters.map((filter) => (
                <button
                  type="button"
                  key={filter.value}
                  aria-pressed={status === filter.value}
                  onClick={() => setStatus(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <label className="dashboard-doctor-filter">
              <span className="sr-only">Filter appointments by doctor</span>
              <select
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
              >
                <option value="">All doctors</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="appointment-search">
            <MagnifyingGlassIcon size={17} />
            <span className="sr-only">
              Search appointment patient or reason
            </span>
            <input
              type="search"
              placeholder="Search patient or reason…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {result.loading ? (
            <Loading text="Loading appointments…" />
          ) : result.error ? (
            <ErrorNotice error={result.error} retry={onRefresh} />
          ) : shown.length === 0 ? (
            <Empty
              title={
                visits.length
                  ? "No matching appointments"
                  : "A little room in the day"
              }
            >
              {visits.length
                ? "Try another status, doctor or search."
                : "There are no appointments on this date. Book a visit or choose another day."}
            </Empty>
          ) : (
            <div className="appointment-list">
              {shown.map((visit) => (
                <button
                  type="button"
                  className="appointment-row"
                  key={visit.id}
                  aria-label={`View ${result.data?.patients.get(visit.patientId)?.name ?? "patient"} at ${time(visit.startsAt)}`}
                  onClick={() => onOpen(visit)}
                >
                  <span className="appointment-time">
                    {time(visit.startsAt)}
                    <small>{time(visit.endsAt)}</small>
                  </span>
                  <span className="avatar">
                    {result.data?.patients
                      .get(visit.patientId)
                      ?.name.slice(0, 1) ?? "?"}
                  </span>
                  <span className="appointment-person">
                    <strong>
                      {result.data?.patients.get(visit.patientId)?.name ??
                        "Patient unavailable"}
                    </strong>
                    <span>{visit.reason}</span>
                    <small>
                      {doctors.find((doctor) => doctor.id === visit.doctorId)
                        ?.name ?? "Doctor unavailable"}
                    </small>
                  </span>
                  <Status value={visit.status} />
                  <ArrowUpRightIcon className="appointment-open" size={17} />
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="dashboard-book-row"
            onClick={onBook}
            disabled={!doctors.some((doctor) => doctor.active)}
          >
            <CalendarBlankIcon size={17} />
            Book a new appointment
            <ArrowUpRightIcon size={16} />
          </button>
        </section>
      </div>
      <aside className="dashboard-aside">
        <DashboardCalendar
          key={date.slice(0, 7)}
          date={date}
          today={today}
          onDate={onDate}
        />
        <section className="day-note">
          <span className="eyebrow">YOUR CLINIC AT A GLANCE</span>
          <h3>Room for good care.</h3>
          <p>
            Choose a day to see every visit and its latest status. Open an
            appointment to view its history or make a change.
          </p>
          <div>
            {doctors
              .filter((doctor) => doctor.active)
              .map((doctor) => (
                <div className="doctor-key" key={doctor.id}>
                  <span className="avatar">
                    {doctor.name.replace(/^Dr\.?\s*/i, "").slice(0, 1)}
                  </span>
                  <span>
                    <strong>{doctor.name}</strong>
                    <small>
                      {doctor.speciality} · {doctor.slotMinutes} min
                    </small>
                  </span>
                </div>
              ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
