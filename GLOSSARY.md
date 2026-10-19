# Clinic scheduling

The language of a two-doctor clinic's appointments, availability, and patient history.

## Language

**Doctor**:
A clinician with a speciality, a standard appointment slot length, and a daily cap.
_Avoid_: Provider, resource

**Patient**:
A person identified by a unique normalized international phone number, with a date
of birth and optional assistance needs.
_Avoid_: Customer, user

**Weekly availability**:
A doctor's recurring working windows for a weekday in the clinic's local time.
_Avoid_: Weekly slots

**Date override**:
The complete replacement availability for one doctor on one local date. An empty
override means leave; windows on an otherwise closed day mean extra availability.
_Avoid_: Exception slot, additive override

**Window**:
A continuous local-time working interval in which whole appointments can fit.
_Avoid_: Appointment, slot

**Slot**:
A bookable interval of exactly one doctor's standard appointment duration, aligned
from the opening of an effective availability window.
_Avoid_: Window

**Appointment**:
A patient's reserved interval with a doctor, including its reason and current status.
_Avoid_: Visit (which can imply completed care)

**Late cancellation**:
A cancellation less than two hours before appointment start, including cancellation
after start while the appointment remains booked.
_Avoid_: No-show

**No-show**:
An appointment marked as unattended after its reserved interval has ended.
_Avoid_: Late cancellation

**Deposit acknowledgement**:
The patient's acknowledgement required when recent late cancellations and no-shows
meet the penalty threshold. It is not a payment or a permanent patient flag.
_Avoid_: Paid deposit, deposit flag

**Reschedule**:
The atomic cancellation of an original appointment and booking of its replacement.
_Avoid_: Moving the original record
