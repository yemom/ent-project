import { NursePatientsPage } from '@/features/nurse/nurse-pages';

/**
 * The nurse's allocated patients.
 *
 * <p>Previously rendered NurseVitalsPage, so following "My Patients" in the sidebar
 * landed on a vitals-entry form: the page answered a different question from the one
 * the link asked.
 */
export default function Page() {
  return <NursePatientsPage />;
}
