import { useCallback, useState } from "react";
import type { ClinicApi } from "../../api/client";
import type { Appointment, Doctor, History } from "../../api/types";
import { dateTime } from "../../shared/time";
import { useResource } from "../../shared/use-resource";
import {
  Empty,
  ErrorNotice,
  Loading,
  Pagination,
  Status,
} from "../../shared/ui";
import { DepositNotice, PatientFinder, PatientSummary } from "./PatientFinder";
import { PatientForm } from "./PatientForm";

function HistoryList({
  api,
  patientId,
  doctors,
  revision,
  onOpen,
}: {
  api: ClinicApi;
  patientId: string;
  doctors: readonly Doctor[];
  revision: number;
  onOpen: (appointment: Appointment) => void;
}) {
  const [offset, setOffset] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) => api.history(patientId, offset, signal),
    [api, patientId, offset],
  );
  const result = useResource(
    load,
    `${api.reviewNow}:${patientId}:${offset}:${revision}`,
  );
  if (result.loading) return <Loading text="Loading appointment history…" />;
  if (result.error) return <ErrorNotice error={result.error} />;
  if (!result.data) return null;
  return (
    <>
      <DepositNotice history={result.data} />
      <div className="section-heading">
        <h3>Appointment history</h3>
        <span className="badge neutral">{result.data.total} appointments</span>
      </div>
      {result.data.items.length === 0 ? (
        <Empty title="No appointments yet">
          This patient’s visits and status history will appear here.
        </Empty>
      ) : (
        <div className="history-list">
          {result.data.items.map((item) => (
            <div className="history-item" key={item.id}>
              <div className="section-heading">
                <div>
                  <strong>{dateTime(item.startsAt)}</strong>
                  <p className="muted">
                    {doctors.find((doctor) => doctor.id === item.doctorId)
                      ?.name ?? "Doctor record unavailable"}{" "}
                    · {item.reason}
                  </p>
                </div>
                <Status value={item.status} />
              </div>
              <details>
                <summary>
                  {item.events.length} status event
                  {item.events.length === 1 ? "" : "s"}
                </summary>
                <ol className="event-list">
                  {item.events.map((event) => (
                    <li key={event.id}>
                      <Status value={event.toStatus} />
                      <span>{dateTime(event.occurredAt)}</span>
                    </li>
                  ))}
                </ol>
              </details>
              <button className="text-button" onClick={() => onOpen(item)}>
                View appointment →
              </button>
            </div>
          ))}
        </div>
      )}
      <Pagination
        offset={offset}
        total={result.data.total}
        onChange={setOffset}
      />
    </>
  );
}
export function Patients({
  api,
  doctors,
  revision,
  onOpen,
  onChange,
}: {
  api: ClinicApi;
  doctors: readonly Doctor[];
  revision: number;
  onOpen: (appointment: Appointment) => void;
  onChange: (message: string) => void;
}) {
  const [selected, setSelected] = useState<History | null>(null);
  const [editing, setEditing] = useState(false);
  return (
    <div className="patients-layout">
      <section className="panel">
        <div className="panel-heading">
          <span className="eyebrow">PATIENT DIRECTORY</span>
          <h2>Find the right record</h2>
          <p className="muted">
            Search by phone to see visit history and assistance needs.
          </p>
        </div>
        <PatientFinder
          api={api}
          refreshKey={revision}
          onSelect={(history) => {
            setSelected(history);
            setEditing(false);
          }}
        />
      </section>
      <section className="panel patient-detail" aria-label="Patient record">
        {!selected ? (
          <Empty title="A little context, a better visit">
            Find or register a patient to see their appointment history here.
          </Empty>
        ) : (
          <div className="stack">
            <div className="section-heading">
              <span className="eyebrow">PATIENT RECORD</span>
              <button
                className="text-button"
                onClick={() => setEditing(!editing)}
              >
                {editing ? "Close editor" : "Edit profile"}
              </button>
            </div>
            {editing ? (
              <PatientForm
                api={api}
                existing={selected.patient}
                onCancel={() => setEditing(false)}
                onSaved={(patient) => {
                  setSelected({ ...selected, patient });
                  setEditing(false);
                  onChange("Patient profile updated.");
                }}
              />
            ) : (
              <PatientSummary history={selected} />
            )}
            <HistoryList
              key={selected.patient.id}
              api={api}
              patientId={selected.patient.id}
              doctors={doctors}
              revision={revision}
              onOpen={onOpen}
            />
          </div>
        )}
      </section>
    </div>
  );
}
