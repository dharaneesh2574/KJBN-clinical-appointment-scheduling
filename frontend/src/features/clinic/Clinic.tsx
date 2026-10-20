import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import type { ClinicApi } from "../../api/client";
import type { Doctor, DoctorInput, LocalWindow } from "../../api/types";
import {
  dateLabel,
  minuteInput,
  minuteValue,
  shiftDate,
} from "../../shared/time";
import { useResource } from "../../shared/use-resource";
import { ErrorNotice, Loading, Modal } from "../../shared/ui";

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
function DoctorForm({
  api,
  doctor,
  onClose,
  onSaved,
}: {
  api: ClinicApi;
  doctor?: Doctor;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(doctor?.name ?? "");
  const [speciality, setSpeciality] = useState(doctor?.speciality ?? "");
  const [slot, setSlot] = useState<15 | 30>(doctor?.slotMinutes ?? 15);
  const [cap, setCap] = useState(doctor?.dailyCap ?? 16);
  const [active, setActive] = useState(doctor?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const input: DoctorInput = {
      name: name.trim(),
      speciality: speciality.trim(),
      slotMinutes: slot,
      dailyCap: cap,
      active,
    };
    try {
      await api.saveDoctor(input, doctor?.id);
      onSaved(
        doctor
          ? "Doctor settings updated."
          : "Doctor added. Set their weekly hours to make slots available.",
      );
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={doctor ? "Edit doctor" : "Add a doctor"}
      onClose={onClose}
      busy={busy}
    >
      <form className="stack" onSubmit={(event) => void submit(event)}>
        {error !== null && <ErrorNotice error={error} />}
        <fieldset className="stack" disabled={busy}>
          <label>
            Doctor name
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Speciality
            <input
              required
              maxLength={120}
              value={speciality}
              onChange={(e) => setSpeciality(e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label>
              Slot length
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value === "30" ? 30 : 15)}
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            </label>
            <label>
              Daily appointment cap
              <input
                type="number"
                required
                min={1}
                max={2147483647}
                value={cap}
                onChange={(e) => setCap(e.target.valueAsNumber)}
              />
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active in booking
          </label>
          <p className="muted small-text">
            Changes that invalidate occupied appointments are rejected with
            their references. Resolve those visits explicitly before changing
            settings.
          </p>
          <button
            className="button"
            type="submit"
            disabled={!name.trim() || !speciality.trim()}
          >
            {busy ? "Saving…" : "Save doctor"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}
function WindowEditor({
  windows,
  onChange,
  disabled,
}: {
  windows: readonly LocalWindow[];
  onChange: (windows: readonly LocalWindow[]) => void;
  disabled: boolean;
}) {
  function change(
    index: number,
    field: "startMinute" | "endMinute",
    value: string,
  ) {
    onChange(
      windows.map((window, i) =>
        i === index ? { ...window, [field]: minuteValue(value) } : window,
      ),
    );
  }
  return (
    <div className="stack">
      <div className="window-list">
        {windows.map((window, index) => (
          <div className="window-row" key={index}>
            <label>
              Start (IST)
              <input
                type="time"
                required
                value={minuteInput(window.startMinute)}
                disabled={disabled}
                onChange={(e) => change(index, "startMinute", e.target.value)}
              />
            </label>
            <span aria-hidden="true">→</span>
            <label>
              End (IST)
              <input
                type="time"
                required
                value={
                  window.endMinute === 1440 ? "" : minuteInput(window.endMinute)
                }
                disabled={disabled || window.endMinute === 1440}
                onChange={(e) => change(index, "endMinute", e.target.value)}
              />
            </label>
            <button
              className="icon-button"
              type="button"
              aria-label={`Remove window ${index + 1}`}
              disabled={disabled}
              onClick={() => onChange(windows.filter((_, i) => i !== index))}
            >
              ×
            </button>
            <label className="check end-midnight">
              <input
                type="checkbox"
                disabled={disabled}
                checked={window.endMinute === 1440}
                onChange={(e) =>
                  onChange(
                    windows.map((w, i) =>
                      i === index
                        ? { ...w, endMinute: e.target.checked ? 1440 : 1020 }
                        : w,
                    ),
                  )
                }
              />
              End at midnight
            </label>
          </div>
        ))}
      </div>
      {windows.length === 0 && (
        <p className="notice quiet">No working windows — the doctor is off.</p>
      )}
      <button
        className="button secondary small"
        type="button"
        disabled={disabled || windows.length >= 32}
        onClick={() =>
          onChange([...windows, { startMinute: 540, endMinute: 780 }])
        }
      >
        ＋ Add working window
      </button>
    </div>
  );
}
function AvailabilityForm({
  api,
  doctor,
  today,
  revision,
  onSaved,
}: {
  api: ClinicApi;
  doctor: Doctor;
  today: string;
  revision: number;
  onSaved: (message: string) => void;
}) {
  const [weekday, setWeekday] = useState(1);
  const [mode, setMode] = useState<"weekly" | "override">("weekly");
  const [date, setDate] = useState(today);
  const [edit, setEdit] = useState<{
    key: string;
    windows: readonly LocalWindow[];
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [localRevision, setLocalRevision] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) =>
      api.availability(doctor.id, date, shiftDate(date, 60), signal),
    [api, doctor.id, date],
  );
  const result = useResource(
    load,
    `${api.reviewNow}:${doctor.id}:${date}:${revision}:${localRevision}`,
  );
  const selectedOverride = result.data?.overrides.find(
    (item) => item.date === date,
  );
  const key = `${doctor.id}:${mode}:${mode === "weekly" ? weekday : date}:${revision}:${localRevision}`;
  const windows =
    edit?.key === key
      ? edit.windows
      : mode === "weekly"
        ? (result.data?.weekly.filter((window) => window.weekday === weekday) ??
          [])
        : (selectedOverride?.windows ?? []);
  const invalid = windows.some(
    (window) =>
      !Number.isInteger(window.startMinute) ||
      !Number.isInteger(window.endMinute) ||
      window.endMinute <= window.startMinute,
  );
  async function save(remove = false) {
    setBusy(true);
    setError(null);
    try {
      if (remove) await api.removeOverride(doctor.id, date);
      else if (mode === "weekly") await api.weekly(doctor.id, weekday, windows);
      else await api.override(doctor.id, date, windows, reason.trim());
      setEdit(null);
      setLocalRevision((n) => n + 1);
      onSaved(
        remove
          ? "Date override removed; weekly hours apply again."
          : mode === "weekly"
            ? "Weekly hours updated."
            : "Whole-day override saved.",
      );
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel stack">
      <div>
        <span className="eyebrow">WORKING HOURS</span>
        <h2>{doctor.name}</h2>
        <p className="muted">
          Weekly hours repeat. A date override replaces the entire day.
        </p>
      </div>
      <fieldset disabled={busy} className="stack">
        <label>
          Availability type
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value === "override" ? "override" : "weekly");
              setError(null);
            }}
          >
            <option value="weekly">Weekly pattern</option>
            <option value="override">Date override / leave</option>
          </select>
        </label>
        {mode === "weekly" ? (
          <label>
            Weekday
            <select
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
            >
              {weekdays.map((day, i) => (
                <option value={i + 1} key={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Override date (IST)
            <input
              type="date"
              required
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
        )}
        {result.loading ? (
          <Loading text="Loading working hours…" />
        ) : result.error ? (
          <ErrorNotice
            error={result.error}
            retry={() => setLocalRevision((n) => n + 1)}
          />
        ) : (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <WindowEditor
              windows={windows}
              disabled={busy}
              onChange={(windows) => setEdit({ key, windows })}
            />
            {mode === "override" && (
              <>
                <p className="small-text muted">
                  {selectedOverride
                    ? `Existing override: ${selectedOverride.reason}`
                    : "No override on this date; weekly hours currently apply."}{" "}
                  Leave all windows empty for leave. Add windows for an extra
                  working day.
                </p>
                <label>
                  Reason for override
                  <input
                    required
                    maxLength={500}
                    placeholder="Leave, additional clinic hours…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              </>
            )}
            {invalid && (
              <p className="field-error" role="alert">
                Every window must end after it starts.
              </p>
            )}
            {error !== null && <ErrorNotice error={error} />}
            <div className="button-row">
              <button
                className="button"
                disabled={
                  busy || invalid || (mode === "override" && !reason.trim())
                }
                type="submit"
              >
                {busy
                  ? "Saving…"
                  : mode === "weekly"
                    ? "Save weekly hours"
                    : "Save date override"}
              </button>
              {mode === "override" && selectedOverride && (
                <button
                  className="button secondary"
                  disabled={busy}
                  type="button"
                  onClick={() => void save(true)}
                >
                  Restore weekly hours
                </button>
              )}
            </div>
          </form>
        )}
      </fieldset>
      {result.data && result.data.overrides.length > 0 && (
        <details>
          <summary>Upcoming overrides · {result.data.overrides.length}</summary>
          <ul className="override-list">
            {result.data.overrides.map((item) => (
              <li key={item.date}>
                <strong>{dateLabel(item.date)}</strong> · {item.reason}
                <span className="muted small-text">
                  {item.windows.length === 0
                    ? "Off / leave"
                    : item.windows
                        .map(
                          (w) =>
                            `${minuteInput(w.startMinute)}–${minuteInput(w.endMinute)}`,
                        )
                        .join(", ")}{" "}
                  IST
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
export function Clinic({
  api,
  doctors,
  today,
  revision,
  onSaved,
}: {
  api: ClinicApi;
  doctors: readonly Doctor[];
  today: string;
  revision: number;
  onSaved: (message: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(doctors[0]?.id ?? "");
  const [editing, setEditing] = useState<Doctor | "new" | null>(null);
  const selected =
    doctors.find((doctor) => doctor.id === selectedId) ?? doctors[0];
  return (
    <>
      <div className="clinic-layout">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CLINIC DIRECTORY</span>
              <h2>Doctors & availability</h2>
            </div>
            <button
              className="button secondary small"
              onClick={() => setEditing("new")}
            >
              ＋ Add doctor
            </button>
          </div>
          <div className="directory-list">
            {doctors.length === 0 && (
              <p className="muted">
                Add the first doctor to configure working hours.
              </p>
            )}
            {doctors.map((doctor) => (
              <div
                className={`directory-item ${selected?.id === doctor.id ? "selected" : ""}`}
                key={doctor.id}
              >
                <button
                  className="directory-select"
                  onClick={() => setSelectedId(doctor.id)}
                >
                  <strong>{doctor.name}</strong>
                  <span>
                    {doctor.speciality} · {doctor.slotMinutes} min · cap{" "}
                    {doctor.dailyCap}
                  </span>
                  <span
                    className={`badge ${doctor.active ? "success" : "neutral"}`}
                  >
                    {doctor.active ? "Active" : "Inactive"}
                  </span>
                </button>
                <button
                  className="text-button"
                  onClick={() => setEditing(doctor)}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </section>
        {selected && (
          <AvailabilityForm
            key={selected.id}
            api={api}
            doctor={selected}
            today={today}
            revision={revision}
            onSaved={onSaved}
          />
        )}
      </div>
      {editing !== null && (
        <DoctorForm
          api={api}
          doctor={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            onSaved(message);
          }}
        />
      )}
    </>
  );
}
