import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { statusLabels } from "./status";
import { ApiError } from "../api/client";
import type { AppointmentStatus, Patient } from "../api/types";

export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <strong>We couldn’t complete that request</strong>
      <p>
        {error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."}
      </p>
      {error instanceof ApiError && (
        <>
          <small>
            {error.code}
            {error.requestId && ` · Reference ${error.requestId}`}
          </small>
          {error.appointmentIds.length > 0 && (
            <details>
              <summary>Affected appointment references</summary>
              <ul>
                {error.appointmentIds.map((id) => (
                  <li key={id}>
                    <code>{id}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {retry && (
        <button className="button secondary small" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Loading({ text = "Loading clinic data…" }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {text}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span aria-hidden="true" className="empty-mark">
        ＋
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Status({ value }: { value: AppointmentStatus }) {
  return (
    <span className={`badge status-${value.toLowerCase()}`}>
      {statusLabels[value]}
    </span>
  );
}
export function PatientFlags({ patient }: { patient: Patient }) {
  return (
    <div className="flag-list">
      {patient.flags.map((flag) => (
        <span className="badge flag" key={flag}>
          {flag === "MOBILITY_ASSISTANCE"
            ? "Mobility assistance"
            : "Interpreter required"}
        </span>
      ))}
      {patient.flags.length === 0 && (
        <span className="muted small-text">No assistance flags recorded</span>
      )}
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-description" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="modal-header">
        <div>
          <span className="eyebrow">KJBN CLINIC</span>
          <h2 id="modal-title">{title}</h2>
          {description && (
            <p id="modal-description" className="muted">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Pagination({
  offset,
  total,
  limit = 20,
  onChange,
}: {
  offset: number;
  total: number;
  limit?: number;
  onChange: (offset: number) => void;
}) {
  return (
    <div className="pagination">
      <span className="muted small-text">
        {total === 0
          ? "0 records"
          : `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}
      </span>
      <div className="button-row">
        <button
          className="button secondary small"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </button>
        <button
          className="button secondary small"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
