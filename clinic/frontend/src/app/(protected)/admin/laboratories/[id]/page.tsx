import { AdminLaboratoryDetailPage } from '@/features/admin/admin-pages';

export const metadata = {
  title: 'Laboratory Dashboard | Clinic',
  description: 'View laboratory operations, orders, and doctor availability'
};

export default async function LaboratoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminLaboratoryDetailPage id={id} />;
}
