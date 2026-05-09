import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layouts/page-header';

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Doctor Settings" description="Manage consultation preferences and notification settings." />
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Account and workflow controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl bg-muted/50 p-4">Consultation reminders enabled</div>
          <div className="rounded-2xl bg-muted/50 p-4">Telehealth notifications enabled</div>
        </CardContent>
      </Card>
    </div>
  );
}
