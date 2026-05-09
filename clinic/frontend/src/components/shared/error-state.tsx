import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ErrorState({ title, message, onRetry }: Readonly<{ title: string; message: string; onRetry?: () => void }>) {
  return (
    <Card className="border-red-200 bg-red-50/70">
      <CardHeader>
        <CardTitle className="text-red-700">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-red-700/80">{message}</p>
        {onRetry ? <Button className="rounded-2xl" variant="destructive" onClick={onRetry}>Try again</Button> : null}
      </CardContent>
    </Card>
  );
}
