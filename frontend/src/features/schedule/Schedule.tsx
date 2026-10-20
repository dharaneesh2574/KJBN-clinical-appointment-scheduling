import { useCallback, useState } from "react";
import type { ClinicApi } from "../../api/client";
import type { Appointment, Doctor, Patient, Slot } from "../../api/types";
import { dateLabel, shiftDate, time } from "../../shared/time";
import { useResource } from "../../shared/use-resource";
import { Empty, ErrorNotice, Loading, Status } from "../../shared/ui";
import type { BookingSelection } from "./BookingDialog";

export function DateNavigator({
  date,
  today,
  onDate,
}: {
  date: string;
  today: string;
  onDate: (date: string) => void;
}) {
  return (
    <div className="date-navigator">
      <button
        className="icon-button"
        aria-label="Previous day"
        onClick={() => onDate(shiftDate(date, -1))}
      >
        ←
      </button>
      <label className="date-control">
        <span className="sr-only">Schedule date (IST)</span>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => {
            if (e.target.value) onDate(e.target.value);
          }}
        />
      </label>
      <button
        className="icon-button"
        aria-label="Next day"
        onClick={() => onDate(shiftDate(date, 1))}
      >
        →
      </button>
      <button className="button secondary small" onClick={() => onDate(today)}>
        Today
      </button>
    </div>
  );
}
interface DoctorDay {
  readonly doctor: Doctor;
  readonly free: readonly Slot[];
}
export function Schedule({
  api,
  doctors,
  date,
  revision,
  onBook,
  onOpen,
  onRefresh,
  moving,
  onMove,
}: {
  api: ClinicApi;
  doctors: readonly Doctor[];
  date: string;
  revision: number;
  onBook: (selection: BookingSelection) => void;
  onOpen: (appointment: Appointment) => void;
  onRefresh: () => void;
  moving: Appointment | null;
  onMove: (appointment: Appointment, target?: BookingSelection) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [dragged, setDragged] = useState<Appointment | null>(null);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const active = doctors.filter((doctor) => doctor.active);
      const [appointments, days] = await Promise.all([
        api.appointments(date, signal),
        Promise.all(
          active.map(async (doctor): Promise<DoctorDay> => ({
            doctor,
            free: await api.slots(doctor.id, date, signal),
          })),
        ),
      ]);
      const patients = new Map<string, Patient>();
      await Promise.all(
        [...new Set(appointments.map((item) => item.patientId))].map(
          async (id) => {
            patients.set(id, await api.patient(id, signal));
          },
        ),
      );
      return { appointments, days, patients };
    },
    [api, doctors, date],
  );
  const result = useResource(load, `${api.reviewNow}:${date}:${revision}`);
  if (result.loading)
    return <Loading text="Loading doctor schedules and live slots…" />;
  if (result.error)
    return <ErrorNotice error={result.error} retry={onRefresh} />;
  if (!result.data) return null;
  const { appointments, days, patients } = result.data;
  const booked = appointments.filter((item) => item.status === "BOOKED");
  const free = days.reduce((count, day) => count + day.free.length, 0);
  const shown = days.filter(
    (day) => filter === "all" || day.doctor.id === filter,
  );
  return (
    <div className="stack spacious">
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon teal" aria-hidden="true">
            ▦
          </span>
          <div>
            <span className="stat-number">{booked.length}</span>
            <span className="stat-label">Booked appointments</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon blue" aria-hidden="true">
            ◷
          </span>
          <div>
            <span className="stat-number">{free}</span>
            <span className="stat-label">Available slots</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon sand" aria-hidden="true">
            ✚
          </span>
          <div>
            <span className="stat-number">{days.length}</span>
            <span className="stat-label">Active doctors</span>
          </div>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h2>Doctor schedules</h2>
          <p className="muted">
            {dateLabel(date)} <span className="separator">/</span> All times IST
          </p>
        </div>
        <label className="compact-select">
          <span className="sr-only">Filter schedule by doctor</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All doctors</option>
            {days.map(({ doctor }) => (
              <option value={doctor.id} key={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="legend">
        <span>
          <i className="legend-dot available" />
          Available
        </span>
        <span>
          <i className="legend-dot booked" />
          Booked
        </span>
        <span>
          <i className="legend-dot finished" />
          Completed / no-show
        </span>
        <span className="muted">
          {moving
            ? "Choose a highlighted slot to move your appointment."
            : "Click a free slot to book. Move a booked visit from its details, or drag it to a free slot."}
        </span>
      </div>
      {days.length === 0 ? (
        <Empty title="No active doctors yet">
          Add or activate a doctor under Clinic settings, then set their working
          hours.
        </Empty>
      ) : (
        <div className="doctor-grid">
          {shown.map(({ doctor, free }) => {
            const visits = appointments.filter(
              (item) => item.doctorId === doctor.id,
            );
            const occupied = visits.filter(
              (item) => !["CANCELLED", "LATE_CANCELLED"].includes(item.status),
            );
            const cancelled = visits.filter((item) =>
              ["CANCELLED", "LATE_CANCELLED"].includes(item.status),
            );
            const timeline: readonly (
              | { kind: "free"; slot: Slot }
              | { kind: "visit"; slot: Appointment }
            )[] = [
              ...free.map((slot) => ({ kind: "free" as const, slot })),
              ...occupied.map((slot) => ({ kind: "visit" as const, slot })),
            ].sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt));
            return (
              <section
                className="doctor-card"
                key={doctor.id}
                aria-label={`${doctor.name} schedule`}
              >
                <header className="doctor-header">
                  <div className="avatar doctor-avatar">
                    {doctor.name.replace(/^Dr\.?\s*/i, "").slice(0, 1)}
                  </div>
                  <div>
                    <h3>{doctor.name}</h3>
                    <p className="muted small-text">
                      {doctor.speciality} · {doctor.slotMinutes}-minute visits
                    </p>
                  </div>
                  <span className="badge neutral">
                    {occupied.length}/{doctor.dailyCap} capacity
                  </span>
                </header>
                <div className="doctor-day-heading">
                  <strong>{free.length} available slots</strong>
                  <span className="muted small-text">
                    {occupied.length} occupied
                  </span>
                </div>
                {timeline.length === 0 ? (
                  <Empty title="No bookable slots">
                    This doctor may be off, at capacity, or have no future slots
                    on this day. Choose another date or check Clinic settings.
                  </Empty>
                ) : (
                  <div className="slot-grid">
                    {timeline.map((item) =>
                      item.kind === "free" ? (
                        <button
                          className={`slot free-slot ${moving || dragged ? "move-target" : ""}`}
                          key={`free:${item.slot.startsAt}`}
                          aria-label={`${moving ? "Move to" : "Book"} ${doctor.name} at ${time(item.slot.startsAt)}`}
                          onDragOver={(event) => {
                            if (!dragged) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (dragged)
                              onMove(dragged, {
                                doctorId: doctor.id,
                                date,
                                slot: item.slot,
                              });
                            setDragged(null);
                          }}
                          onClick={() =>
                            onBook({
                              doctorId: doctor.id,
                              date,
                              slot: item.slot,
                            })
                          }
                        >
                          <span className="slot-time">
                            {time(item.slot.startsAt)}{" "}
                            <span aria-hidden="true">–</span>{" "}
                            {time(item.slot.endsAt)}
                          </span>
                          <span className="slot-description">
                            {moving
                              ? "Move here"
                              : dragged
                                ? "Drop to review move"
                                : "Available"}{" "}
                            <span aria-hidden="true">
                              {moving ? "→" : "＋"}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <button
                          className={`slot visit-slot ${item.slot.status === "BOOKED" ? "" : "finished-slot"}`}
                          key={item.slot.id}
                          disabled={!!moving}
                          draggable={!moving && item.slot.status === "BOOKED"}
                          onDragStart={(event) => {
                            if (moving || item.slot.status !== "BOOKED") {
                              event.preventDefault();
                              return;
                            }
                            event.dataTransfer.setData(
                              "application/x-kjbn-appointment",
                              item.slot.id,
                            );
                            event.dataTransfer.effectAllowed = "move";
                            setDragged(item.slot);
                          }}
                          onDragEnd={() => setDragged(null)}
                          aria-label={`View ${patients.get(item.slot.patientId)?.name ?? "patient"} at ${time(item.slot.startsAt)}`}
                          onClick={() => onOpen(item.slot)}
                        >
                          <span className="slot-time">
                            {time(item.slot.startsAt)}–{time(item.slot.endsAt)}
                          </span>
                          <strong className="slot-patient">
                            {patients.get(item.slot.patientId)?.name ??
                              "Patient record unavailable"}
                          </strong>
                          <Status value={item.slot.status} />
                        </button>
                      ),
                    )}
                  </div>
                )}
                {cancelled.length > 0 && (
                  <details className="cancelled-list">
                    <summary>
                      {cancelled.length} cancelled appointment
                      {cancelled.length === 1 ? "" : "s"}
                    </summary>
                    {cancelled.map((item) => (
                      <button
                        className="cancelled-row"
                        key={item.id}
                        onClick={() => onOpen(item)}
                      >
                        <span>
                          {time(item.startsAt)} ·{" "}
                          {patients.get(item.patientId)?.name}
                        </span>
                        <Status value={item.status} />
                      </button>
                    ))}
                  </details>
                )}
                <footer className="doctor-footer">
                  <span className="small-text muted">
                    {doctor.slotMinutes} min per appointment
                  </span>
                  <button
                    className="text-button"
                    disabled={free.length === 0}
                    onClick={() =>
                      onBook({ doctorId: doctor.id, date, slot: free[0] })
                    }
                  >
                    {moving ? "Choose first available →" : "Book a visit →"}
                  </button>
                </footer>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
export function TodayQueue({
  api,
  doctors,
  today,
  revision,
  onOpen,
  onRefresh,
}: {
  api: ClinicApi;
  doctors: readonly Doctor[];
  today: string;
  revision: number;
  onOpen: (appointment: Appointment) => void;
  onRefresh: () => void;
}) {
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [includeFinished, setIncludeFinished] = useState(false);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const items = (await api.appointments(today, signal)).filter(
        (item) => !["CANCELLED", "LATE_CANCELLED"].includes(item.status),
      );
      const patients = new Map<string, Patient>();
      await Promise.all(
        [...new Set(items.map((item) => item.patientId))].map(async (id) =>
          patients.set(id, await api.patient(id, signal)),
        ),
      );
      return { items, patients };
    },
    [api, today],
  );
  const result = useResource(load, `${api.reviewNow}:${today}:${revision}`);
  if (result.loading) return <Loading text="Loading today’s queue…" />;
  if (result.error)
    return <ErrorNotice error={result.error} retry={onRefresh} />;
  if (!result.data) return null;
  const { items, patients } = result.data;
  const shown = items.filter(
    (item) =>
      (includeFinished || item.status === "BOOKED") &&
      (doctorFilter === "all" || item.doctorId === doctorFilter),
  );
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">TODAY · {dateLabel(today)}</span>
          <h2>Keep the day moving</h2>
          <p className="muted">
            Booked appointments in time order. Open a visit to update its
            status.
          </p>
        </div>
        <span className="badge neutral">
          {items.filter((item) => item.status === "BOOKED").length} booked
        </span>
      </div>
      <div className="queue-filters">
        <label>
          Doctor
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
          >
            <option value="all">All doctors</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={includeFinished}
            onChange={(e) => setIncludeFinished(e.target.checked)}
          />
          Include completed and no-shows
        </label>
      </div>
      {shown.length === 0 ? (
        <Empty title="The queue is clear">
          No appointments match this view for today in IST.
        </Empty>
      ) : (
        <div className="queue-list">
          {shown.map((item) => (
            <button
              className="queue-item"
              key={item.id}
              onClick={() => onOpen(item)}
            >
              <span className="queue-time">
                {time(item.startsAt)}
                <small>–{time(item.endsAt)}</small>
              </span>
              <span className="queue-patient">
                <strong>
                  {patients.get(item.patientId)?.name ??
                    "Patient record unavailable"}
                </strong>
                <span className="muted small-text">
                  {doctors.find((doctor) => doctor.id === item.doctorId)?.name}{" "}
                  · {item.reason}
                </span>
              </span>
              <Status value={item.status} />
              <span className="queue-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
