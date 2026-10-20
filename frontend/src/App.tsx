import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarBlankIcon,
  SquaresFourIcon,
  UsersIcon,
  ListChecksIcon,
  FirstAidKitIcon,
  PlusIcon,
  ArrowsClockwiseIcon,
} from "@phosphor-icons/react";
import { Dashboard } from "./features/schedule/Dashboard";
import { BookingWizard } from "./features/schedule/BookingWizard";
import { ClinicApi } from "./api/client";
import type { Appointment, Doctor } from "./api/types";
import { Clinic } from "./features/clinic/Clinic";
import { Patients } from "./features/patients/Patients";
import { AppointmentDialog } from "./features/schedule/AppointmentDialog";
import { BookingDialog } from "./features/schedule/BookingDialog";
import type {
  BookingDraft,
  BookingSelection,
} from "./features/schedule/BookingDialog";
import {
  DateNavigator,
  Schedule,
  TodayQueue,
} from "./features/schedule/Schedule";
import {
  clinicDate,
  dateLabel,
  dateTime,
  isReviewInstant,
  time,
} from "./shared/time";
import { ErrorNotice, Loading } from "./shared/ui";
import { useClinicTime } from "./shared/use-clinic-time";
import { useResource } from "./shared/use-resource";
import "./App.css";
import "./features/schedule/dashboard.css";
import "./features/schedule/booking.css";

type Tab = "dashboard" | "schedule" | "patients" | "queue" | "clinic";
const tabs: readonly {
  id: Tab;
  title: string;
  subtitle: string;
  nav: string;
}[] = [
  {
    id: "dashboard",
    title: "Appointments & scheduling",
    subtitle: "Every visit, one clear view. Let’s make today run smoothly.",
    nav: "Dashboard",
  },
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
  const icons = {
    dashboard: SquaresFourIcon,
    schedule: CalendarBlankIcon,
    patients: UsersIcon,
    queue: ListChecksIcon,
    clinic: FirstAidKitIcon,
  };
  const Icon = icons[tab];
  return <Icon size={20} aria-hidden="true" />;
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
  onTab,
}: {
  api: ClinicApi;
  initialDoctors: readonly Doctor[];
  tab: Tab;
  onTab: (tab: Tab) => void;
}) {
  const [doctors, setDoctors] = useState(initialDoctors);
  const now = useClinicTime(api.reviewNow);
  const today = clinicDate(now);
  const [date, setDate] = useState(today);
  const [revision, setRevision] = useState(0);
  const [booking, setBooking] = useState<BookingSelection | null>(null);
  const [wizard, setWizard] = useState(false);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [moving, setMoving] = useState<Appointment | null>(null);
  const moveHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (moving && tab === "schedule") moveHeading.current?.focus();
  }, [moving, tab]);
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
    setWizard(false);
    setBooking(null);
    setBookingDraft(null);
    setMoving(null);
    setAppointment(null);
    setMessage(message);
    setRevision((n) => n + 1);
    if (directory) void refresh();
  }
  function startMove(item: Appointment, target?: BookingSelection) {
    setAppointment(null);
    setBookingDraft(null);
    setMoving(item);
    setMessage("");
    setDate(target?.date ?? clinicDate(item.startsAt));
    setBooking(target ? { ...target, original: item } : null);
    onTab("schedule");
  }
  function chooseSlot(selection: BookingSelection) {
    setBooking(moving ? { ...selection, original: moving } : selection);
    setMessage("");
  }
  const current = tabs.find((item) => item.id === tab) ?? tabs[0];
  const active = doctors.find((doctor) => doctor.active);
  return (
    <>
      <div
        className={`page-heading ${tab === "dashboard" ? "dashboard-page-heading" : ""}`}
      >
        <div>
          <span className="eyebrow">YOUR CLINIC, IN SYNC</span>
          <h1>{current.title}</h1>
          <p className="muted">{current.subtitle}</p>
        </div>
        <button
          className="button"
          disabled={!active}
          onClick={() => {
            setMoving(null);
            setBookingDraft(null);
            setMessage("");
            setWizard(true);
          }}
        >
          <PlusIcon size={18} aria-hidden="true" /> Book appointment
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
      {moving && tab === "schedule" && (
        <section className="move-banner" aria-label="Move appointment">
          <div role="status">
            <span className="eyebrow">MOVE MODE</span>
            <h2 ref={moveHeading} tabIndex={-1}>
              Choose a new slot
            </h2>
            <p>
              From {doctors.find((item) => item.id === moving.doctorId)?.name} ·{" "}
              {dateTime(moving.startsAt)}
            </p>
            <p className="small-text">
              Pick an available slot below, or change the day. Your original
              appointment stays booked until you confirm.
            </p>
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setMoving(null);
              setBookingDraft(null);
              setMessage(
                "Move cancelled. The original appointment is unchanged.",
              );
            }}
          >
            Cancel move
          </button>
        </section>
      )}
      <div
        className={`workspace-toolbar ${tab === "dashboard" ? "dashboard-toolbar" : ""}`}
      >
        {tab === "schedule" ? (
          <DateNavigator date={date} today={today} onDate={setDate} />
        ) : (
          <p className="small-text muted">
            {dateLabel(tab === "dashboard" ? date : today)}{" "}
            <span className="separator">/</span> Asia/Kolkata (IST)
          </p>
        )}
        <button
          className="button secondary small"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          <ArrowsClockwiseIcon size={16} aria-hidden="true" />{" "}
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="workspace-content">
        {tab === "dashboard" && (
          <Dashboard
            api={api}
            doctors={doctors}
            date={date}
            today={today}
            revision={revision}
            onDate={setDate}
            onOpen={setAppointment}
            onBook={() => setWizard(true)}
            onRefresh={() => void refresh()}
          />
        )}
        {tab === "schedule" && (
          <Schedule
            api={api}
            doctors={doctors}
            date={date}
            revision={revision}
            onBook={chooseSlot}
            moving={moving}
            onMove={startMove}
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
      {wizard && (
        <BookingWizard
          api={api}
          doctors={doctors}
          initialDate={tab === "dashboard" || tab === "schedule" ? date : today}
          onClose={() => setWizard(false)}
          onSaved={(message, savedDate) => {
            setDate(savedDate);
            onTab("dashboard");
            changed(message);
          }}
        />
      )}
      {booking && (
        <BookingDialog
          api={api}
          doctors={doctors}
          selection={booking}
          draft={bookingDraft}
          onClose={() => {
            setBooking(null);
            setBookingDraft(null);
          }}
          onChooseSlot={(draft) => {
            setBookingDraft(draft);
            setBooking(null);
            setRevision((n) => n + 1);
            setMessage(
              "Choose another available slot. Your patient and reason are kept.",
            );
          }}
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
          onReschedule={startMove}
        />
      )}
    </>
  );
}
function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
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
            setTab("dashboard");
          }}
          aria-label="KJBN Clinic dashboard"
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
                onTab={setTab}
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
