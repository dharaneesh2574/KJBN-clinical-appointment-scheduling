import { useState } from "react";
import {
  CaretLeftIcon,
  CheckIcon,
  StethoscopeIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import type { ClinicApi } from "../../api/client";
import type { Doctor, History, Slot } from "../../api/types";
import { clinicDate, shiftDate } from "../../shared/time";
import { useClinicTime } from "../../shared/use-clinic-time";
import { Modal } from "../../shared/ui";
import { PatientFinder, PatientSummary } from "../patients/PatientFinder";
import { AvailabilityPicker } from "./AvailabilityPicker";
import { BookingDialog } from "./BookingDialog";
import type { BookingDraft } from "./BookingDialog";

export function BookingWizard({
  api,
  doctors,
  initialDate,
  onClose,
  onSaved,
}: {
  api: ClinicApi;
  doctors: readonly Doctor[];
  initialDate: string;
  onClose: () => void;
  onSaved: (message: string, date: string) => void;
}) {
  const today = clinicDate(useClinicTime(api.reviewNow));
  const last = shiftDate(today, 60);
  const [step, setStep] = useState<"people" | "time" | "review">("people");
  const [patient, setPatient] = useState<History | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(
    initialDate >= today && initialDate <= last ? initialDate : today,
  );
  const [slot, setSlot] = useState<Slot | null>(null);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const doctor = doctors.find(
    (doctor) => doctor.id === doctorId && doctor.active,
  );
  if (step === "review" && slot && doctor && patient)
    return (
      <BookingDialog
        api={api}
        doctors={doctors}
        selection={{ doctorId, date, slot }}
        variant="dialog"
        draft={draft ?? { patient, reason: "", acknowledged: false }}
        onClose={onClose}
        onSaved={(message) => onSaved(message, date)}
        onChooseSlot={(value) => {
          setDraft(value);
          setPatient(value.patient);
          setStep(value.patient ? "time" : "people");
        }}
      />
    );
  return (
    <Modal
      title={step === "people" ? "Book an appointment" : "Pick a date and time"}
      description={
        step === "people"
          ? "Start with the patient and their doctor."
          : "Choose a time that works. All times are IST."
      }
      variant="booking"
      onClose={onClose}
    >
      <ol className="booking-steps" aria-label="Booking progress">
        {["Patient & doctor", "Date & time", "Confirm"].map((label, index) => (
          <li
            key={label}
            aria-current={
              (step === "people" ? 0 : 1) === index ? "step" : undefined
            }
          >
            <span>
              {step === "time" && index === 0 ? (
                <CheckIcon size={12} />
              ) : (
                index + 1
              )}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {step === "people" ? (
        <div className="wizard-people stack">
          <section className="stack">
            <h3>
              <UserCircleIcon size={20} />
              Patient
            </h3>
            {patient ? (
              <>
                <PatientSummary history={patient} />
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setPatient(null);
                    setDraft(null);
                  }}
                >
                  Change patient
                </button>
              </>
            ) : (
              <PatientFinder
                api={api}
                onSelect={(history) => {
                  setPatient(history);
                  setDraft(null);
                }}
              />
            )}
          </section>
          <section className="stack">
            <h3>
              <StethoscopeIcon size={20} />
              Doctor
            </h3>
            <label>
              Select doctor
              <select
                value={doctorId}
                onChange={(event) => {
                  setDoctorId(event.target.value);
                  setSlot(null);
                }}
              >
                <option value="">Choose a doctor</option>
                {doctors
                  .filter((doctor) => doctor.active)
                  .map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} · {doctor.speciality} · {doctor.slotMinutes}{" "}
                      min
                    </option>
                  ))}
              </select>
            </label>
            {doctor && (
              <p className="small-text muted">
                {doctor.slotMinutes}-minute visits. The next step shows this
                doctor’s live availability.
              </p>
            )}
          </section>
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button"
              disabled={!patient || !doctor}
              onClick={() => setStep("time")}
            >
              Choose date & time
            </button>
          </div>
        </div>
      ) : doctor ? (
        <>
          <div className="picker-context">
            <button
              type="button"
              className="text-button"
              onClick={() => setStep("people")}
            >
              <CaretLeftIcon size={14} />
              Patient & doctor
            </button>
            <span>
              {patient?.patient.name} <span aria-hidden="true">·</span>{" "}
              <strong>{doctor.name}</strong>{" "}
              <small>{doctor.slotMinutes} min</small>
            </span>
          </div>
          <AvailabilityPicker
            api={api}
            doctorId={doctor.id}
            date={date}
            today={today}
            selected={slot}
            onDate={(value) => {
              setDate(value);
              setSlot(null);
            }}
            onSelect={setSlot}
            onContinue={() => setStep("review")}
          />
        </>
      ) : null}
    </Modal>
  );
}
