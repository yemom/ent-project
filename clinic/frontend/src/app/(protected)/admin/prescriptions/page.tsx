import { redirect } from 'next/navigation';

export default function AdminPrescriptionsPage() {
  // Super Admin has NO access to clinical prescriptions per strict safety rules
  redirect('/admin');
}