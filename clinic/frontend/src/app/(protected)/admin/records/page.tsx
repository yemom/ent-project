import { redirect } from 'next/navigation';

export default function AdminRecordsPage() {
  // Super Admin has NO access to clinical records per strict HIPAA/safety rules
  redirect('/admin');
}