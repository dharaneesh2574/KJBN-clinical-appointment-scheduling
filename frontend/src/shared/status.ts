import type { AppointmentStatus } from "../api/types";

export const statusLabels: Readonly<Record<AppointmentStatus, string>> = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  LATE_CANCELLED: "Late-cancelled",
  NO_SHOW: "No-show",
};
