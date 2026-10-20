import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "../../api/client";
import type { ClinicApi } from "../../api/client";
import type { Appointment, Doctor, History, Slot } from "../../api/types";
import { clinicDate, dateLabel, time } from "../../shared/time";
import { useResource } from "../../shared/use-resource";
import { ErrorNotice, Loading, Modal } from "../../shared/ui";
import {
  DepositNotice,
  PatientFinder,
  PatientSummary,
} from "../patients/PatientFinder";

export interface BookingSelection {
  readonly doctorId: string;
  readonly date: string;
  readonly slot: Slot;
  readonly original?: Appointment;
}
export interface BookingDraft {
  readonly patient: History | null;
  readonly reason: string;
  readonly acknowledged: boolean;
}
interface BookingProps {
  api: ClinicApi;
  doctors: readonly Doctor[];
  selection: BookingSelection;
  draft: BookingDraft | null;
  onClose: () => void;
  onChooseSlot: (draft: BookingDraft) => void;
  onSaved: (message: string) => void;
  variant?: "drawer" | "dialog";
}
export function BookingDialog(props: BookingProps) {
  const original = props.selection.original;
  return original ? (
    <MoveBooking {...props} original={original} />
  ) : (
    <BookingPanel {...props} />
  );
}
function MoveBooking(props: BookingProps & { original: Appointment }) {
  const { api, original } = props;
  const [revision, setRevision] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) => api.history(original.patientId, 0, signal),
    [api, original.patientId],
  );
  const result = useResource(
    load,
    `${api.reviewNow}:${original.patientId}:${revision}`,
  );
  if (result.data)
    return <BookingPanel {...props} existingPatient={result.data} />;
  return (
    <Modal
      title="Confirm appointment move"
      variant={props.variant ?? "drawer"}
      onClose={props.onClose}
    >
      {result.loading ? (
        <Loading text="Checking this patient’s current eligibility…" />
      ) : (
        <ErrorNotice
          error={result.error}
          retry={() => setRevision((n) => n + 1)}
        />
      )}
    </Modal>
  );
}
function BookingPanel({
  api,
  doctors,
  selection,
  draft,
  existingPatient,
  onClose,
  onChooseSlot,
  onSaved,
  variant = "drawer",
}: BookingProps & { existingPatient?: History }) {
  const [patient, setPatient] = useState<History | null>(
    existingPatient ?? draft?.patient ?? null,
  );
  const [reason, setReason] = useState(
    draft?.reason ?? selection.original?.reason ?? "",
  );
  const [acknowledged, setAcknowledged] = useState(
    draft?.acknowledged ?? false,
  );
  const [editReason, setEditReason] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) =>
      api.slots(selection.doctorId, selection.date, signal),
    [api, selection.doctorId, selection.date],
  );
  const slots = useResource(
    load,
    `${api.reviewNow}:${selection.doctorId}:${selection.date}:${revision}`,
  );
  const validSlot =
    slots.data?.some((slot) => slot.startsAt === selection.slot.startsAt) ??
    false;
  const needsDeposit =
    !!patient?.deposit.required ||
    (error instanceof ApiError && error.code === "DEPOSIT_REQUIRED");
  const doctor = doctors.find((item) => item.id === selection.doctorId);
  const oldDoctor = doctors.find(
    (item) => item.id === selection.original?.doctorId,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy ||
      !patient ||
      !validSlot ||
      !reason.trim() ||
      (needsDeposit && !acknowledged)
    )
      return;
    setBusy(true);
    setError(null);
    const input = {
      doctorId: selection.doctorId,
      startsAt: selection.slot.startsAt,
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
        selection.original ? "Confirm appointment move" : "Book an appointment"
      }
      description="Times shown in India Standard Time (IST)."
      variant={variant}
      onClose={onClose}
      busy={busy}
    >
      <div className="stack">
        <section
          className="slot-summary"
          aria-label="Selected appointment slot"
        >
          {selection.original && (
            <div className="previous-slot">
              <span className="eyebrow">FROM</span>
              <p>{oldDoctor?.name ?? "Original doctor"}</p>
              <p>
                {dateLabel(clinicDate(selection.original.startsAt))},{" "}
                {time(selection.original.startsAt)}–
                {time(selection.original.endsAt)} IST
              </p>
            </div>
          )}
          <span className="eyebrow">
            {selection.original ? "TO" : "YOUR SELECTED SLOT"}
          </span>
          <h3>{doctor?.name ?? "Selected doctor"}</h3>
          <p>{dateLabel(selection.date)}</p>
          <strong>
            {time(selection.slot.startsAt)}–{time(selection.slot.endsAt)} IST
          </strong>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => onChooseSlot({ patient, reason, acknowledged })}
          >
            Choose another slot
          </button>
        </section>
        {slots.loading ? (
          <Loading text="Checking selected slot…" />
        ) : slots.error ? (
          <ErrorNotice
            error={slots.error}
            retry={() => setRevision((n) => n + 1)}
          />
        ) : (
          !validSlot && (
            <div className="notice warning" role="status">
              This slot is no longer available. Choose another slot; your
              patient and reason will be kept.
            </div>
          )
        )}
        {patient ? (
          <div className="stack">
            <PatientSummary history={patient} />
            {patient.deposit.required && <DepositNotice history={patient} />}
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
        ) : (
          <PatientFinder
            api={api}
            onSelect={(history) => {
              setPatient(history);
              setAcknowledged(false);
            }}
          />
        )}
        <form onSubmit={(event) => void submit(event)} className="stack">
          {error !== null && <ErrorNotice error={error} />}
          <fieldset disabled={busy} className="stack">
            {selection.original && !editReason ? (
              <div className="notice quiet">
                <strong>Reason for visit</strong>
                <p>{reason}</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setEditReason(true)}
                >
                  Edit reason
                </button>
              </div>
            ) : (
              <label>
                Reason for visit
                <textarea
                  required
                  maxLength={500}
                  rows={2}
                  placeholder="A brief reason for the appointment"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            {needsDeposit && (
              <label className="check deposit-check">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  required
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>Deposit acknowledged (required for this patient)</span>
              </label>
            )}
            {selection.original && (
              <p className="muted small-text">
                The original stays booked until you confirm this move. A move
                within 2 hours of the original start counts as a late
                cancellation and may require deposit acknowledgement.
              </p>
            )}
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
                  (needsDeposit && !acknowledged)
                }
              >
                {busy
                  ? "Saving appointment…"
                  : selection.original
                    ? "Confirm move"
                    : "Confirm booking"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </Modal>
  );
}
