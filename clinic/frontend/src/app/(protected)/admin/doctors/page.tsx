import { StaffDirectoryPage } from '@/features/admin/staff-directory-page';

export default function Page() {
  return (
    <StaffDirectoryPage
      role="DOCTOR"
      title="Doctors"
      description="Clinical doctors, specializations, licenses and account status."
      icon="doctor"
    />
  );
}
