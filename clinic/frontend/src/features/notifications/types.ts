export type NotificationType =
  | 'LAB_ORDER_CREATED'
  | 'LAB_RESULT_READY'
  | 'PATIENT_ASSIGNED'
  | 'APPOINTMENT_REMINDER'
  | 'PRESCRIPTION_READY';

export interface Notification {
  id: string;
  type: NotificationType | string;
  title: string;
  message: string;
  /** In-app route the bell navigates to when clicked. */
  link: string | null;
  readAt: string | null;
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