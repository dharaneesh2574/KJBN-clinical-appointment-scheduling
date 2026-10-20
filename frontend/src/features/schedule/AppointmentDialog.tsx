import { useCallback, useState } from "react";
import type { ClinicApi } from "../../api/client";
import type { Appointment, Doctor } from "../../api/types";
import { dateTime } from "../../shared/time";
import { useResource } from "../../shared/use-resource";
import { useClinicTime } from "../../shared/use-clinic-time";
import {
  ErrorNotice,
  Loading,
  Modal,
  PatientFlags,
  Status,
} from "../../shared/ui";

export function AppointmentDialog({
  api,
  appointment,
  doctors,
  onClose,
  onChanged,
  onReschedule,
}: {
  api: ClinicApi;
  appointment: Appointment;
  doctors: readonly Doctor[];
  onClose: () => void;
  onChanged: (message: string) => void;
  onReschedule: (appointment: Appointment) => void;
}) {
  const now = useClinicTime(api.reviewNow);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [visit, patient] = await Promise.all([
        api.appointment(appointment.id, signal),
        api.patient(appointment.patientId, signal),
      ]);
      return { visit, patient };
    },
    [api, appointment.id, appointment.patientId],
  );
  const result = useResource(
    load,
    `${api.reviewNow}:${appointment.id}:${revision}`,
  );
  async function change(action: "cancel" | "COMPLETED" | "NO_SHOW") {
    setBusy(true);
    setError(null);
    try {
      const item =
        action === "cancel"
          ? await api.cancel(appointment.id)
          : await api.finish(appointment.id, action);
      onChanged(
        action === "cancel"
          ? `Appointment ${item.status === "LATE_CANCELLED" ? "late-cancelled" : "cancelled"}. History is preserved.`
          : action === "COMPLETED"
            ? "Appointment marked completed."
            : "Appointment marked no-show.",
      );
    } catch (error) {
      setError(error);
      setRevision((n) => n + 1);
      setCancelConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  const data = result.data;
  const canFinish = data && Date.parse(data.visit.endsAt) <= Date.parse(now);
  return (
    <Modal title="Appointment details" onClose={onClose} busy={busy}>
      <div className="stack">
        {result.loading && <Loading text="Loading the latest appointment…" />}
        {result.error && (
          <ErrorNotice
            error={result.error}
            retry={() => setRevision((n) => n + 1)}
          />
        )}
        {error !== null && <ErrorNotice error={error} />}
        {data && (
          <>
            <div className="section-heading">
              <div>
                <h3>{data.patient.name}</h3>
                <p className="muted">{data.patient.phone}</p>
              </div>
              <Status value={data.visit.status} />
            </div>
            <PatientFlags patient={data.patient} />
            <dl className="detail-grid">
              <div>
                <dt>Doctor</dt>
                <dd>
                  {doctors.find((doctor) => doctor.id === data.visit.doctorId)
                    ?.name ?? "Doctor record unavailable"}
                </dd>
              </div>
              <div>
                <dt>Appointment</dt>
                <dd>
                  {dateTime(data.visit.startsAt)}–
                  {dateTime(data.visit.endsAt).split(", ").pop()}
                </dd>
              </div>
              <div>
                <dt>Reason for visit</dt>
                <dd>{data.visit.reason}</dd>
              </div>
              <div>
                <dt>Deposit acknowledgement</dt>
                <dd>
                  {data.visit.depositAcknowledgedAt
                    ? dateTime(data.visit.depositAcknowledgedAt)
                    : "Not recorded"}
                </dd>
              </div>
            </dl>
            {data.visit.rescheduledFromId && (
              <p className="notice quiet small-text">
                Replacement for appointment{" "}
                <code>{data.visit.rescheduledFromId}</code>.
              </p>
            )}
            <details>
              <summary>
                Status history · {data.visit.events.length} events
              </summary>
              <ol className="event-list">
                {data.visit.events.map((event) => (
                  <li key={event.id}>
                    <Status value={event.toStatus} />
                    <span>{dateTime(event.occurredAt)}</span>
                  </li>
                ))}
              </ol>
            </details>
            {data.visit.status === "BOOKED" && (
              <div className="stack action-section">
                <div className="button-row">
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => onReschedule(data.visit)}
                  >
                    Move appointment
                  </button>
                  <button
                    className="button secondary danger-text"
                    disabled={busy}
                    onClick={() => setCancelConfirm(true)}
                  >
                    Cancel appointment
                  </button>
                </div>
                {cancelConfirm && (
                  <div className="notice warning">
                    <strong>Cancel this appointment?</strong>
                    <p>
                      Cancelling less than 2 hours before the start is a late
                      cancellation and counts toward deposit eligibility. The
                      API decides using its request clock.
                    </p>
                    <div className="button-row">
                      <button
                        className="button danger"
                        disabled={busy}
                        onClick={() => void change("cancel")}
                      >
                        {busy ? "Cancelling…" : "Yes, cancel appointment"}
                      </button>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => setCancelConfirm(false)}
                      >
                        Keep appointment
                      </button>
                    </div>
                  </div>
                )}
                <div className="button-row">
                  <button
                    className="button secondary"
                    disabled={busy || !canFinish}
                    onClick={() => void change("COMPLETED")}
                  >
                    Mark completed
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy || !canFinish}
                    onClick={() => void change("NO_SHOW")}
                  >
                    Mark no-show
                  </button>
                </div>
                {!canFinish && (
                  <small>
                    Completion and no-show become available after the
                    appointment ends (IST).
                  </small>
                )}
              </div>
            )}
            <small className="record-reference">
              Appointment reference: {data.visit.id}
            </small>
          </>
        )}
      </div>
    </Modal>
  );
}
