import { useState } from "react";
import type { FormEvent } from "react";
import type { ClinicApi } from "../../api/client";
import type { Patient, PatientFlag } from "../../api/types";
import { clinicDate } from "../../shared/time";
import { useClinicTime } from "../../shared/use-clinic-time";
import { ErrorNotice } from "../../shared/ui";

export function PatientForm({
  api,
  existing,
  onSaved,
  onCancel,
}: {
  api: ClinicApi;
  existing?: Patient;
  onSaved: (patient: Patient) => void;
  onCancel: () => void;
}) {
  const today = clinicDate(useClinicTime(api.reviewNow));
  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [dob, setDob] = useState(existing?.dateOfBirth ?? "");
  const [flags, setFlags] = useState<readonly PatientFlag[]>(
    existing?.flags ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  function toggle(flag: PatientFlag, checked: boolean) {
    setFlags(checked ? [...flags, flag] : flags.filter((f) => f !== flag));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await api.savePatient(
          { name: name.trim(), phone, dateOfBirth: dob, flags },
          existing?.id,
        ),
      );
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="stack"
      aria-label={existing ? "Edit patient profile" : "Register a patient"}
    >
      {error !== null && <ErrorNotice error={error} />}
      <fieldset disabled={busy} className="stack">
        <label>
          Full name
          <input
            required
            maxLength={120}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Phone with country code
            <input
              required
              type="tel"
              placeholder="+91 98765 43210"
              maxLength={40}
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <small>Include + and the country code.</small>
          </label>
          <label>
            Date of birth
            <input
              required
              type="date"
              min="0001-01-01"
              max={today}
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </label>
        </div>
        <div>
          <p className="field-label">Assistance needs</p>
          <label className="check">
            <input
              type="checkbox"
              checked={flags.includes("MOBILITY_ASSISTANCE")}
              onChange={(e) => toggle("MOBILITY_ASSISTANCE", e.target.checked)}
            />
            Mobility assistance
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={flags.includes("INTERPRETER_REQUIRED")}
              onChange={(e) => toggle("INTERPRETER_REQUIRED", e.target.checked)}
            />
            Interpreter required
          </label>
          <small>
            These flags help the clinic prepare for the visit. They do not
            create deposit penalties.
          </small>
        </div>
        <div className="button-row">
          <button className="button" type="submit" disabled={!name.trim()}>
            {busy ? "Saving…" : existing ? "Save patient" : "Register patient"}
          </button>
          <button className="button secondary" type="button" onClick={onCancel}>
            Back
          </button>
        </div>
      </fieldset>
    </form>
  );
}
