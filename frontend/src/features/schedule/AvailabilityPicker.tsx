import { useCallback, useState } from "react";
import {
  CaretLeftIcon,
  CaretRightIcon,
  SunHorizonIcon,
  SunIcon,
  MoonIcon,
} from "@phosphor-icons/react";
import type { ClinicApi } from "../../api/client";
import type { Slot } from "../../api/types";
import { clinicTimezone, dateLabel, shiftDate, time } from "../../shared/time";
import { Empty, ErrorNotice, Loading } from "../../shared/ui";
import { useResource } from "../../shared/use-resource";

export function AvailabilityPicker({
  api,
  doctorId,
  date,
  today,
  selected,
  onDate,
  onSelect,
  onContinue,
}: {
  api: ClinicApi;
  doctorId: string;
  date: string;
  today: string;
  selected: Slot | null;
  onDate: (date: string) => void;
  onSelect: (slot: Slot) => void;
  onContinue: () => void;
}) {
  const max = shiftDate(today, 60);
  const [start, setStart] = useState(date);
  const [revision, setRevision] = useState(0);
  const days = Array.from({ length: 7 }, (_, index) =>
    shiftDate(start, index),
  ).filter((day) => day <= max);
  const load = useCallback(
    async (signal: AbortSignal) =>
      Promise.all(
        Array.from({ length: 7 }, (_, index) => shiftDate(start, index))
          .filter((day) => day <= max)
          .map(async (day) => ({
            date: day,
            slots: await api.slots(doctorId, day, signal),
          })),
      ),
    [api, doctorId, start, max],
  );
  const availability = useResource(
    load,
    `${api.reviewNow}:${doctorId}:${start}:${revision}`,
  );
  const loadVisits = useCallback(
    (signal: AbortSignal) => api.appointments(date, signal),
    [api, date],
  );
  const appointments = useResource(
    loadVisits,
    `${api.reviewNow}:${date}:${revision}`,
  );
  const free = availability.data?.find((day) => day.date === date)?.slots ?? [];
  const booked =
    appointments.data?.filter(
      (visit) =>
        visit.doctorId === doctorId &&
        !["CANCELLED", "LATE_CANCELLED"].includes(visit.status),
    ) ?? [];
  const entries = new Map<string, Slot & { available: boolean }>();
  for (const slot of free)
    entries.set(slot.startsAt, { ...slot, available: true });
  for (const visit of booked)
    entries.set(visit.startsAt, {
      startsAt: visit.startsAt,
      endsAt: visit.endsAt,
      available: false,
    });
  const slots = [...entries.values()].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  );
  const pending = availability.loading || appointments.loading;
  const error = availability.error ?? appointments.error;
  const canContinue =
    !pending && !error && selected && entries.get(selected.startsAt)?.available;
  const groups = [
    { label: "Morning", Icon: SunHorizonIcon, min: 0, max: 12 },
    { label: "Afternoon", Icon: SunIcon, min: 12, max: 17 },
    { label: "Evening", Icon: MoonIcon, min: 17, max: 24 },
  ];
  return (
    <section className="availability-picker" aria-label="Doctor availability">
      <div className="picker-month">
        <strong>
          {new Intl.DateTimeFormat("en-IN", {
            month: "long",
            year: "numeric",
            timeZone: clinicTimezone,
          }).format(new Date(`${start}T12:00:00+05:30`))}
        </strong>
        <div className="button-row">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous seven days"
            disabled={start <= today}
            onClick={() => {
              const day =
                shiftDate(start, -7) < today ? today : shiftDate(start, -7);
              setStart(day);
              onDate(day);
            }}
          >
            <CaretLeftIcon size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Next seven days"
            disabled={shiftDate(start, 7) > max}
            onClick={() => {
              const day = shiftDate(start, 7);
              setStart(day);
              onDate(day);
            }}
          >
            <CaretRightIcon size={16} />
          </button>
        </div>
      </div>
      <div className="booking-days">
        {days.map((day) => (
          <button
            type="button"
            key={day}
            aria-label={`Choose ${dateLabel(day, true)}`}
            aria-pressed={date === day}
            onClick={() => onDate(day)}
          >
            <span>
              {new Intl.DateTimeFormat("en-IN", {
                weekday: "short",
                timeZone: clinicTimezone,
              }).format(new Date(`${day}T12:00:00+05:30`))}
            </span>
            <strong>{Number(day.slice(8))}</strong>
            <small>
              {availability.loading
                ? "Checking"
                : availability.error
                  ? "Unavailable"
                  : `${availability.data?.find((item) => item.date === day)?.slots.length ?? 0} open`}
            </small>
          </button>
        ))}
      </div>
      <label className="picker-jump">
        Pick another date
        <input
          type="date"
          aria-label="Booking date (IST)"
          required
          value={date}
          min={today}
          max={max}
          onChange={(event) => {
            const day = event.target.value;
            if (day >= today && day <= max) {
              setStart(day);
              onDate(day);
            }
          }}
        />
      </label>
      <div className="picker-times">
        {pending ? (
          <Loading text="Checking doctor availability…" />
        ) : error ? (
          <ErrorNotice error={error} retry={() => setRevision((n) => n + 1)} />
        ) : slots.length === 0 ? (
          <Empty title="No available times">
            Choose another date or go back to select a different doctor.
          </Empty>
        ) : (
          <>
            {groups.map(({ label, Icon, min, max }) => {
              const period = slots.filter((slot) => {
                const hour = Number(time(slot.startsAt).slice(0, 2));
                return hour >= min && hour < max;
              });
              return (
                period.length > 0 && (
                  <section
                    className="time-period"
                    key={label}
                    aria-label={`${label} slots`}
                  >
                    <h3>
                      <Icon size={16} />
                      {label}
                    </h3>
                    <div className="time-chips">
                      {period.map((slot) => (
                        <button
                          type="button"
                          key={slot.startsAt}
                          disabled={!slot.available}
                          aria-label={`${time(slot.startsAt)} IST${slot.available ? "" : " — occupied"}`}
                          aria-pressed={
                            slot.available &&
                            selected?.startsAt === slot.startsAt
                          }
                          className={!slot.available ? "occupied-time" : ""}
                          onClick={() =>
                            onSelect({
                              startsAt: slot.startsAt,
                              endsAt: slot.endsAt,
                            })
                          }
                        >
                          {time(slot.startsAt)}
                        </button>
                      ))}
                    </div>
                  </section>
                )
              );
            })}
            <p className="small-text muted">
              Crossed-out times are occupied. All dates and times are IST.
            </p>
          </>
        )}
      </div>
      <div className="picker-footer">
        <span>
          {selected
            ? `${dateLabel(date)} · ${time(selected.startsAt)}–${time(selected.endsAt)} IST`
            : "Choose an available time"}
        </span>
        <button
          type="button"
          className="button"
          disabled={!canContinue}
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </section>
  );
}
