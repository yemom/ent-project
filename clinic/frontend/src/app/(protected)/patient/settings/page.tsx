import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layouts/page-header';

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Patient Settings" description="Control reminders, privacy, and notification preferences." />
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Account and communication controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl bg-muted/50 p-4">SMS reminders enabled</div>
          <div className="rounded-2xl bg-muted/50 p-4">Email health updates enabled</div>
        </CardContent>
      </Card>
    </div>
  );
}
