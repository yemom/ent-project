'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useCurrentUser } from '@/hooks/use-auth';
import { usePrefetchDashboard } from '@/components/layouts/prefetch-link';
import { cn } from '@/lib/utils';
import { AiAssistantPanel, AiForecastCard } from '@/features/ai/ai-assistant-panel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AppShellProps {
  role?: string;
  children: React.ReactNode;
}

const STORAGE_COLLAPSED_KEY = 'cms_sidebar_desktop_collapsed';

export function AppShell({ role, children }: AppShellProps) {
  // Synchronise user permissions & profile in background
  useCurrentUser();

  // Warm current role's dashboard queries
  const prefetchDashboard = usePrefetchDashboard();
  useEffect(() => {
    prefetchDashboard();
  }, [prefetchDashboard]);

  // Sidebar collapse state
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem(STORAGE_COLLAPSED_KEY);
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_COLLAPSED_KEY, JSON.stringify(next));
      } catch (_err) {
        void _err;
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground">
      {/* Sidebar navigation */}
      <Sidebar
        role={role}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-all duration-200',
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        )}
      >
        <Topbar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onOpenMobile={() => setMobileOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <AiForecastCard />
            {children}
          </div>
        </main>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            aria-label="Open AI assistant"
            className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-xl sm:right-8"
          >
            <MessageCircle className="h-6 w-6" aria-hidden />
            <span className="sr-only">Open AI assistant</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-5xl overflow-hidden p-0">
          <div className="border-b border-border bg-background px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              AI Assistant
            </DialogTitle>
            <DialogDescription className="mt-1">
              Answers from live records for your role. Read-only unless an action is explicitly confirmed.
            </DialogDescription>
          </div>
          <div className="grid max-h-[calc(100vh-10rem)] min-h-[32rem] md:grid-cols-[12rem_1fr]">
            <aside className="hidden border-r border-border bg-slate-50/80 p-4 md:block">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Conversations
              </p>
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-foreground">
                Current session
              </div>
              <p className="mt-5 text-xs leading-5 text-muted-foreground">
                Ask about the forecast, appointments, workload, stock, laboratory queues, or
                financial records available to your account.
              </p>
            </aside>
            <div className="overflow-y-auto p-4 sm:p-6">
              <AiAssistantPanel compact className="border-0 shadow-none" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AppShell;
