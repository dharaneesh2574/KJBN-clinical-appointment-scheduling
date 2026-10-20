import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ClinicApi } from "./api/client";
import type { Appointment, Doctor } from "./api/types";
import { Clinic } from "./features/clinic/Clinic";
import { Patients } from "./features/patients/Patients";
import { AppointmentDialog } from "./features/schedule/AppointmentDialog";
import { BookingDialog } from "./features/schedule/BookingDialog";
import type { BookingSelection } from "./features/schedule/BookingDialog";
import {
  DateNavigator,
  Schedule,
  TodayQueue,
} from "./features/schedule/Schedule";
import { clinicDate, dateLabel, isReviewInstant, time } from "./shared/time";
import { ErrorNotice, Loading } from "./shared/ui";
import { useClinicTime } from "./shared/use-clinic-time";
import { useResource } from "./shared/use-resource";
import "./App.css";

type Tab = "schedule" | "patients" | "queue" | "clinic";
const tabs: readonly {
  id: Tab;
  title: string;
  subtitle: string;
  nav: string;
}[] = [
  {
    id: "schedule",
    title: "A well-planned day.",
    subtitle: "A clear view of every doctor, visit and available slot.",
    nav: "Schedule",
  },
  {
    id: "patients",
    title: "Care starts with context.",
    subtitle: "Patient records, visit history and the details that matter.",
    nav: "Patients",
  },
  {
    id: "queue",
    title: "Today, at a glance.",
    subtitle: "Manage the day’s visits, one appointment at a time.",
    nav: "Today’s queue",
  },
  {
    id: "clinic",
    title: "Make room for good care.",
    subtitle: "Manage doctors, recurring hours and date-specific changes.",
    nav: "Clinic settings",
  },
];
function NavIcon({ tab }: { tab: Tab }) {
  const paths: Readonly<Record<Tab, string>> = {
    schedule: "M4 5h16v15H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2",
    patients:
      "M16 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M17 5a3 3 0 0 1 0 6 M20 20v-2a4 4 0 0 0-3-3.87",
    queue: "M8 5h12 M8 12h12 M8 19h12 M3 5h1 M3 12h1 M3 19h1",
    clinic: "M4 20V6h16v14H4z M9 6V3h6v3 M9 12h6 M12 9v6",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[tab]} />
    </svg>
  );
}
function ReviewerClock({
  value,
  onApply,
}: {
  value: string;
  onApply: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft && !isReviewInstant(draft)) {
      setError(
        "Enter a timestamp with a timezone, such as 2026-10-20T09:00:00+05:30.",
      );
      return;
    }
    setError("");
    onApply(draft);
  }
  return (
    <details className="review-controls">
      <summary>Reviewer clock</summary>
      <form className="stack" onSubmit={submit}>
        <p>
          Optional test aid. The API must have REVIEW_MODE enabled. Applying
          time reloads records and sends X-Review-Now on every request. It is
          kept only in this page’s memory.
        </p>
        <label>
          Review instant with timezone
          <input
            value={draft}
            placeholder="2026-10-20T09:00:00+05:30"
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "review-error" : undefined}
          />
        </label>
        {error && (
          <p id="review-error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row">
          <button className="button small" type="submit">
            Apply reviewer time
          </button>
          <button
            className="button secondary small"
            type="button"
            onClick={() => {
              setDraft("");
              setError("");
              onApply("");
            }}
          >
            Use real time
          </button>
        </div>
      </form>
    </details>
  );
}
function Workspace({
  api,
  initialDoctors,
  tab,
}: {
  api: ClinicApi;
  initialDoctors: readonly Doctor[];
  tab: Tab;
}) {
  const [doctors, setDoctors] = useState(initialDoctors);
  const now = useClinicTime(api.reviewNow);
  const today = clinicDate(now);
  const [date, setDate] = useState(today);
  const [revision, setRevision] = useState(0);
  const [booking, setBooking] = useState<BookingSelection | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [message, setMessage] = useState("");
  const [directoryError, setDirectoryError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    setRefreshing(true);
    setDirectoryError(null);
    setRevision((n) => n + 1);
    try {
      setDoctors(await api.doctors());
    } catch (error) {
      setDirectoryError(error);
    } finally {
      setRefreshing(false);
    }
  }
  function changed(message: string, directory = false) {
    setBooking(null);
    setAppointment(null);
    setMessage(message);
    setRevision((n) => n + 1);
    if (directory) void refresh();
  }
  const current = tabs.find((item) => item.id === tab) ?? tabs[0];
  const active = doctors.find((doctor) => doctor.active);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR CLINIC, IN SYNC</span>
          <h1>{current.title}</h1>
          <p className="muted">{current.subtitle}</p>
        </div>
        <button
          className="button"
          disabled={!active}
          onClick={() => {
            if (active)
              setBooking({
                doctorId: active.id,
                date: tab === "schedule" ? date : today,
              });
          }}
        >
          <span aria-hidden="true">＋</span> Book appointment
        </button>
      </div>
      {api.reviewNow && (
        <div className="notice warning review-banner" role="status">
          <strong>Reviewer time is active</strong>
          <span>
            {dateLabel(today)} · {time(api.reviewNow)} IST. Today’s queue and
            penalties use this fixed time.
          </span>
        </div>
      )}
      {message && (
        <div className="notice success-notice" role="status">
          <span>✓ {message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss confirmation"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}
      {directoryError !== null && (
        <ErrorNotice error={directoryError} retry={() => void refresh()} />
      )}
      <div className="workspace-toolbar">
        {tab === "schedule" ? (
          <DateNavigator date={date} today={today} onDate={setDate} />
        ) : (
          <p className="small-text muted">
            {dateLabel(today)} <span className="separator">/</span> Asia/Kolkata
            (IST)
          </p>
        )}
        <button
          className="button secondary small"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          <span aria-hidden="true">↻</span>{" "}
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="workspace-content">
        {tab === "schedule" && (
          <Schedule
            api={api}
            doctors={doctors}
            date={date}
            revision={revision}
            onBook={setBooking}
            onOpen={setAppointment}
            onRefresh={() => void refresh()}
          />
        )}
        {tab === "patients" && (
          <Patients
            api={api}
            doctors={doctors}
            revision={revision}
            onOpen={setAppointment}
            onChange={changed}
          />
        )}
        {tab === "queue" && (
          <TodayQueue
            api={api}
            doctors={doctors}
            today={today}
            revision={revision}
            onOpen={setAppointment}
            onRefresh={() => void refresh()}
          />
        )}
        {tab === "clinic" && (
          <Clinic
            api={api}
            doctors={doctors}
            today={today}
            revision={revision}
            onSaved={(message) => changed(message, true)}
          />
        )}
      </div>
      {booking && (
        <BookingDialog
          api={api}
          doctors={doctors}
          selection={booking}
          onClose={() => setBooking(null)}
          onSaved={changed}
        />
      )}
      {appointment && (
        <AppointmentDialog
          api={api}
          appointment={appointment}
          doctors={doctors}
          onClose={() => setAppointment(null)}
          onChanged={changed}
          onReschedule={(item) => {
            setAppointment(null);
            setBooking({
              doctorId: item.doctorId,
              date: clinicDate(item.startsAt),
              original: item,
            });
          }}
        />
      )}
    </>
  );
}
function App() {
  const [tab, setTab] = useState<Tab>("schedule");
  const [reviewNow, setReviewNow] = useState("");
  const [revision, setRevision] = useState(0);
  const api = useMemo(() => new ClinicApi(reviewNow), [reviewNow]);
  const load = useCallback((signal: AbortSignal) => api.doctors(signal), [api]);
  const directory = useResource(load, `${reviewNow}:${revision}`);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setTab("schedule");
          }}
          aria-label="KJBN Clinic schedule"
        >
          <span className="brand-mark" aria-hidden="true">
            ✚
          </span>
          <span>
            <strong>
              KJBN<span className="brand-light">clinic</span>
            </strong>
            <small>ROOM FOR BETTER CARE</small>
          </span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Clinic navigation">
          {tabs.map((item) => (
            <button
              key={item.id}
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
            >
              <NavIcon tab={item.id} />
              <span>{item.nav}</span>
              {tab === item.id && (
                <span className="nav-active-dot" aria-hidden="true" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="small-cross" aria-hidden="true">
            ✚
          </span>
          <strong>
            A little less admin.
            <br />A little more care.
          </strong>
          <p>One connected workspace for your clinic’s day.</p>
        </div>
        <div className="sidebar-footer">
          <span className="connection-dot" aria-hidden="true" />
          <span>
            Clinic workspace<small>Asia/Kolkata · IST</small>
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Clinic workspace <span>/</span>{" "}
            <strong>{tabs.find((item) => item.id === tab)?.nav}</strong>
          </span>
          <span className="timezone-pill">
            <span aria-hidden="true">◷</span> India Standard Time
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          {directory.loading ? (
            <Loading text="Connecting to the clinic…" />
          ) : directory.error ? (
            <div className="stack">
              <h1>Let’s reconnect.</h1>
              <ErrorNotice
                error={directory.error}
                retry={() => setRevision((n) => n + 1)}
              />
            </div>
          ) : (
            directory.data && (
              <Workspace
                key={reviewNow}
                api={api}
                initialDoctors={directory.data}
                tab={tab}
              />
            )
          )}
        </main>
        <footer className="app-footer">
          <span>
            KJBN Clinic <span className="separator">/</span> Thoughtful care.
            Clearly organised.
          </span>
          <ReviewerClock
            value={reviewNow}
            onApply={(value) => {
              setReviewNow(value);
              setRevision((n) => n + 1);
            }}
          />
        </footer>
      </div>
    </div>
  );
}
export default App;
