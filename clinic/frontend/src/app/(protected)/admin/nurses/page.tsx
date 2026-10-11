import { StaffDirectoryPage } from '@/features/admin/staff-directory-page';

export default function Page() {
  return (
    <StaffDirectoryPage
      role="NURSE"
      title="Nurses"
      description="Nursing staff, their allocations and account status."
      icon="nurse"
    />
  );
}