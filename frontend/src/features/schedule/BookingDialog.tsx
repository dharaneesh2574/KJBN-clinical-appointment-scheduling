import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import type { ClinicApi } from "../../api/client";
import type { Appointment, Doctor, History, Slot } from "../../api/types";
import { clinicDate, shiftDate, time } from "../../shared/time";
import { useResource } from "../../shared/use-resource";
import { useClinicTime } from "../../shared/use-clinic-time";
import { ErrorNotice, Loading, Modal } from "../../shared/ui";
import {
  DepositNotice,
  PatientFinder,
  PatientSummary,
} from "../patients/PatientFinder";

export interface BookingSelection {
  readonly doctorId: string;
  readonly date: string;
  readonly slot?: Slot;
  readonly original?: Appointment;
}
function ExistingPatient({
  api,
  id,
  onReady,
}: {
  api: ClinicApi;
  id: string;
  onReady: (history: History) => void;
}) {
  const [revision, setRevision] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) => api.history(id, 0, signal),
    [api, id],
  );
  const result = useResource(load, `${api.reviewNow}:${id}:${revision}`);
  if (result.loading)
    return <Loading text="Loading this patient’s current eligibility…" />;
  if (result.error)
    return (
      <ErrorNotice
        error={result.error}
        retry={() => setRevision((n) => n + 1)}
      />
    );
  if (!result.data) return null;
  return (
    <div className="stack">
      <PatientSummary history={result.data} />
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          if (result.data) onReady(result.data);
        }}
      >
        Continue with this patient
      </button>
    </div>
  );
}
export function BookingDialog({
  api,
  doctors,
  selection,
  onClose,
  onSaved,
}: {
  api: ClinicApi;
  doctors: readonly Doctor[];
  selection: BookingSelection;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [doctorId, setDoctorId] = useState(selection.doctorId);
  const [date, setDate] = useState(selection.date);
  const [startsAt, setStartsAt] = useState(selection.slot?.startsAt ?? "");
  const [patient, setPatient] = useState<History | null>(null);
  const [reason, setReason] = useState(selection.original?.reason ?? "");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const today = clinicDate(useClinicTime(api.reviewNow));
  const load = useCallback(
    (signal: AbortSignal) => api.slots(doctorId, date, signal),
    [api, doctorId, date],
  );
  const slots = useResource(
    load,
    `${api.reviewNow}:${doctorId}:${date}:${revision}`,
  );
  const validSlot =
    slots.data?.some((slot) => slot.startsAt === startsAt) ?? false;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!patient || !validSlot) return;
    setBusy(true);
    setError(null);
    const input = {
      doctorId,
      startsAt,
      reason: reason.trim(),
      depositAcknowledged: acknowledged,
    };
    try {
      if (selection.original)
        await api.reschedule(selection.original.id, input);
      else await api.book(patient.patient.id, input);
      onSaved(
        selection.original
          ? "Appointment rescheduled. The original and replacement are linked in history."
          : "Appointment booked successfully.",
      );
    } catch (error) {
      setError(error);
      setRevision((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        selection.original ? "Reschedule appointment" : "Book an appointment"
      }
      description="All appointment dates and times are in Asia/Kolkata (IST)."
      onClose={onClose}
      busy={busy}
    >
      <div className="stack">
        <section className="form-section">
          <div className="step-title">
            <span>1</span>
            <h3>Patient</h3>
          </div>
          {patient ? (
            <div className="stack">
              <PatientSummary history={patient} />
              <DepositNotice history={patient} />
              {!selection.original && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setPatient(null);
                    setAcknowledged(false);
                  }}
                >
                  Change patient
                </button>
              )}
            </div>
          ) : selection.original ? (
            <ExistingPatient
              api={api}
              id={selection.original.patientId}
              onReady={setPatient}
            />
          ) : (
            <PatientFinder
              api={api}
              onSelect={(history) => {
                setPatient(history);
                setAcknowledged(false);
              }}
            />
          )}
        </section>
        <form onSubmit={(event) => void submit(event)} className="stack">
          {error !== null && <ErrorNotice error={error} />}
          <fieldset disabled={busy} className="stack">
            <section className="form-section stack">
              <div className="step-title">
                <span>2</span>
                <h3>Choose a valid slot</h3>
              </div>
              <div className="form-grid">
                <label>
                  Doctor
                  <select
                    value={doctorId}
                    onChange={(e) => {
                      setDoctorId(e.target.value);
                      setStartsAt("");
                    }}
                  >
                    {doctors
                      .filter((doctor) => doctor.active)
                      .map((doctor) => (
                        <option value={doctor.id} key={doctor.id}>
                          {doctor.name} · {doctor.slotMinutes} min
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Appointment date
                  <input
                    required
                    type="date"
                    min={today}
                    max={shiftDate(today, 60)}
                    value={date}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDate(e.target.value);
                        setStartsAt("");
                      }
                    }}
                  />
                </label>
              </div>
              {slots.loading ? (
                <Loading text="Checking available slots…" />
              ) : slots.error ? (
                <ErrorNotice
                  error={slots.error}
                  retry={() => setRevision((n) => n + 1)}
                />
              ) : (
                <label>
                  Available time (IST)
                  <select
                    required
                    value={validSlot ? startsAt : ""}
                    onChange={(e) => setStartsAt(e.target.value)}
                  >
                    <option value="">
                      {slots.data?.length
                        ? "Select an available time"
                        : "No free slots — choose another doctor or date"}
                    </option>
                    {slots.data?.map((slot) => (
                      <option key={slot.startsAt} value={slot.startsAt}>
                        {time(slot.startsAt)}–{time(slot.endsAt)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <small>
                Slots are live snapshots. The clinic rechecks availability,
                overlaps, daily limits and patient eligibility when you submit.
              </small>
            </section>
            <section className="form-section stack">
              <div className="step-title">
                <span>3</span>
                <h3>Visit details</h3>
              </div>
              <label>
                Reason for visit
                <textarea
                  required
                  maxLength={500}
                  rows={3}
                  placeholder="A brief reason for the appointment"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <label className="check deposit-check">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  required={patient?.deposit.required ?? false}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>
                  Deposit acknowledged
                  {patient?.deposit.required
                    ? " (required for this patient)"
                    : " (if applicable)"}
                </span>
              </label>
              {selection.original && (
                <p className="muted small-text">
                  Rescheduling cancels the original and books the replacement
                  together. A late cancellation may add a penalty and trigger a
                  deposit requirement. If the new booking fails, the original
                  stays unchanged.
                </p>
              )}
            </section>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={onClose}
              >
                Back
              </button>
              <button
                type="submit"
                className="button"
                disabled={
                  !patient ||
                  !validSlot ||
                  !reason.trim() ||
                  (!!patient.deposit.required && !acknowledged)
                }
              >
                {busy
                  ? "Saving appointment…"
                  : selection.original
                    ? "Confirm reschedule"
                    : "Confirm booking"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </Modal>
  );
}
