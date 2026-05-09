'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AuthForm({
  title,
  description,
  children,
  footer
}: Readonly<{ title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }>) {
  return (
    <Card className="border-white/70 bg-white/95 shadow-soft backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        {footer ? <div className="pt-2">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
