/**
 * Mirrors the backend `NotificationType` enum.
 *
 * <p>Declared as a closed union over the enum's actual constants rather than the
 * five the bell originally styled. A narrower list was not a compile error — the
 * field is typed `NotificationType | string` — it just silently fell through to a
 * grey badge, so every appointment and prescription notification rendered
 * unlabelled. The `SYSTEM` fallback keeps the union honest against a database that
 * may gain a type before this file is updated.
 */
export type NotificationType =
  // Laboratory
  | 'LAB_ORDER_CREATED'
  | 'LAB_RESULT_READY'
  // Scheduling and administration
  | 'PATIENT_ASSIGNED'
  | 'APPOINTMENT_REMINDER'
  | 'PRESCRIPTION_READY'
  | 'SYSTEM'
  // Appointments
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_RESCHEDULED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_STATUS_CHANGED'
  // Prescriptions
  | 'PRESCRIPTION_CREATED'
  | 'PRESCRIPTION_STATUS_CHANGED';

/**
 * The categories the notification screen offers as a filter.
 *
 * <p>Grouped the way a reader thinks about them rather than alphabetically, and
 * deliberately a subset of {@link NotificationType}: these are the categories the
 * system actually emits, so the filter never offers a filter that returns nothing
 * forever.
 */
export const FILTERABLE_NOTIFICATION_TYPES: Array<{
  value: NotificationType;
  label: string;
}> = [
  { value: 'APPOINTMENT_CREATED', label: 'Appointment booked' },
  { value: 'APPOINTMENT_RESCHEDULED', label: 'Appointment rescheduled' },
  { value: 'APPOINTMENT_CANCELLED', label: 'Appointment cancelled' },
  { value: 'APPOINTMENT_STATUS_CHANGED', label: 'Appointment status changed' },
  { value: 'APPOINTMENT_REMINDER', label: 'Appointment reminder' },
  { value: 'PRESCRIPTION_CREATED', label: 'Prescription received' },
  { value: 'PRESCRIPTION_STATUS_CHANGED', label: 'Prescription status changed' },
  { value: 'PRESCRIPTION_READY', label: 'Prescription ready' },
  { value: 'LAB_ORDER_CREATED', label: 'Lab order raised' },
  { value: 'LAB_RESULT_READY', label: 'Lab result ready' },
  { value: 'PATIENT_ASSIGNED', label: 'Patient assigned' },
  { value: 'SYSTEM', label: 'System' },
];

/** Read-state filter. `null` means "show both". */
export type ReadFilter = 'all' | 'unread' | 'read';

export interface Notification {
  id: string;
  type: NotificationType | string;
  title: string;
  message: string;
  /** Id of the related record, for audit and deep-linking. */
  referenceId: string | null;
  /** In-app route the bell navigates to when clicked. */
  link: string | null;
  readAt: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPage {
  content: Notification[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
