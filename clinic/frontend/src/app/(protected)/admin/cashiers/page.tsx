import { StaffDirectoryPage } from '@/features/admin/staff-directory-page';

export default function Page() {
  return (
    <StaffDirectoryPage
      role="CASHIER"
      title="Cashiers"
      description="Cashier accounts that can take payments."
      icon="cashier"
    />
  );
}