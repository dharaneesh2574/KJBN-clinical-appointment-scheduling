import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "../../api/client";
import type { ClinicApi } from "../../api/client";
import type { History } from "../../api/types";
import { useResource } from "../../shared/use-resource";
import { clinicDate, dateLabel } from "../../shared/time";
import { ErrorNotice, Loading, PatientFlags } from "../../shared/ui";
import { PatientForm } from "./PatientForm";

export function PatientSummary({ history }: { history: History }) {
  return (
    <div className="patient-summary">
      <div className="avatar">
        {history.patient.name.slice(0, 1).toUpperCase()}
      </div>
      <div>
        <h3>{history.patient.name}</h3>
        <p className="muted small-text">
          {history.patient.phone} · Born{" "}
          {dateLabel(history.patient.dateOfBirth)}
        </p>
        <PatientFlags patient={history.patient} />
      </div>
    </div>
  );
}
export function DepositNotice({ history }: { history: History }) {
  return (
    <div className={`notice ${history.deposit.required ? "warning" : "quiet"}`}>
      <strong>
        {history.deposit.required
          ? "Deposit acknowledgement required"
          : "No deposit acknowledgement required"}
      </strong>
      <p>
        {history.deposit.penaltyCount} late cancellation
        {history.deposit.penaltyCount === 1 ? "" : "s"} / no-show
        {history.deposit.penaltyCount === 1 ? "" : "s"} in the trailing 30 days.{" "}
        {history.deposit.required
          ? "Two or more recent penalties require acknowledgement before booking."
          : "Fewer than two recent penalties."}
      </p>
      <small>
        Calculated by the clinic API as of{" "}
        {dateLabel(clinicDate(history.deposit.asOf))}. Eligibility expires as
        events leave the window. This is acknowledgement, not payment
        processing.
      </small>
    </div>
  );
}
function LookupResult({
  api,
  phone,
  revision,
  onSelect,
}: {
  api: ClinicApi;
  phone: string;
  revision: number;
  onSelect: (history: History) => void;
}) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const patient = await api.lookup(phone, signal);
      return api.history(patient.id, 0, signal);
    },
    [api, phone],
  );
  const result = useResource(load, `${api.reviewNow}:${phone}:${revision}`);
  if (result.loading)
    return <Loading text="Finding patient and recent penalties…" />;
  if (result.error instanceof ApiError && result.error.status === 404)
    return (
      <div className="notice quiet" role="status">
        <strong>No patient found</strong>
        <p>Check the country code and number, or register a patient below.</p>
      </div>
    );
  if (result.error) return <ErrorNotice error={result.error} />;
  if (!result.data) return null;
  const history = result.data;
  return (
    <div className="stack">
      <PatientSummary history={history} />
      <DepositNotice history={history} />
      <button
        type="button"
        className="button secondary"
        onClick={() => onSelect(history)}
      >
        Use this patient
      </button>
    </div>
  );
}
export function PatientFinder({
  api,
  onSelect,
  refreshKey = 0,
}: {
  api: ClinicApi;
  refreshKey?: number;
  onSelect: (history: History) => void;
}) {
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [register, setRegister] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(phone.trim());
    setRevision((n) => n + 1);
  }
  if (register)
    return (
      <div className="stack">
        <h3>Register a patient</h3>
        {error !== null && <ErrorNotice error={error} />}
        {loading ? (
          <Loading text="Loading the new patient record…" />
        ) : (
          <PatientForm
            api={api}
            onCancel={() => setRegister(false)}
            onSaved={(patient) => {
              setLoading(true);
              setError(null);
              void api
                .history(patient.id)
                .then(onSelect)
                .catch((error: unknown) => {
                  setError(error);
                  setRegister(false);
                  setPhone(patient.phone);
                  setSearch(patient.phone);
                })
                .finally(() => setLoading(false));
            }}
          />
        )}
      </div>
    );
  return (
    <div className="stack">
      <form onSubmit={submit}>
        <label>
          Patient phone number
          <div className="input-action">
            <input
              type="tel"
              required
              autoComplete="off"
              placeholder="Include country code, e.g. +91…"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setSearch("");
              }}
            />
            <button className="button secondary" type="submit">
              Find patient
            </button>
          </div>
        </label>
      </form>
      {search && (
        <LookupResult
          api={api}
          phone={search}
          revision={revision + refreshKey}
          onSelect={onSelect}
        />
      )}
      <div className="inline-divider">
        <span>New to the clinic?</span>
        <button
          type="button"
          className="text-button"
          onClick={() => setRegister(true)}
        >
          Register patient
        </button>
      </div>
    </div>
  );
}
