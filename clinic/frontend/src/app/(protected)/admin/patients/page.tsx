import { StaffDirectoryPage } from '@/features/admin/staff-directory-page';

export default function Page() {
  return (
    <StaffDirectoryPage
      role="PATIENT"
      title="Patients"
      description="Patient directory (demographics and account status only — strictly no clinical records)."
      icon="patient"
    />
  );
}
