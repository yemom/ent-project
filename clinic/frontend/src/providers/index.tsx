"use client";

import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthHydrator } from './auth-hydrator';
import { QueryProvider } from './query-provider';
import { ServerWakeUp } from './server-wakeup';

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryProvider>
        <AuthHydrator />
        <ServerWakeUp />
        {children}
        <Toaster position="top-right" richColors closeButton />
      </QueryProvider>
    </ThemeProvider>
  );
}