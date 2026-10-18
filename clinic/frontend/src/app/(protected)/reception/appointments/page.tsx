import { ReceptionAppointmentsPage } from '@/features/appointments/reception-appointments-page';

/**
 * Reception → Appointments.
 *
 * <p>Previously rendered `ReceptionPlaceholderPage`, which printed "This area reuses
 * the existing scheduling screens" and offered nothing. The booking screen now lives
 * with the other appointment code in `features/appointments` rather than in the
 * front-desk feature, because it is not front-desk-specific: the same list and
 * dialogs are what a hospital administrator needs.
 */
export default function Page() {
  return <ReceptionAppointmentsPage />;
}