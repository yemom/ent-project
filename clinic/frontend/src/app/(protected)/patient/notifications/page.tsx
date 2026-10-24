import { redirect } from 'next/navigation';

/**
 * The patient's notifications live on the shared screen.
 *
 * <p>This page used to render "notifications" built from the patient's appointments
 * — a status line per booking, presented as though it were the notification
 * history. That was not the notifications table at all, so a patient with real
 * notifications saw none of them and a patient without saw invented ones. Its
 * fetch was also wrapped in `catch(() => setItems([]))`, which made a failed
 * request indistinguishable from an empty inbox.
 *
 * <p>The shared page reads `GET /notifications`, which is already scoped to the
 * authenticated caller, so a patient gets their own notifications and nobody
 * else's — with the category filter, read-state filter and pagination the
 * placeholder never had.
 */
export default function PatientNotificationsPage() {
  redirect('/notifications');
}
