import { StaffDirectoryPage } from '@/features/admin/staff-directory-page';

export default function Page() {
  return (
    <StaffDirectoryPage
      role="PHARMACIST"
      title="Pharmacists"
      description="Pharmacy staff who can verify and dispense."
      icon="pharmacist"
    />
  );
}