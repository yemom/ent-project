'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useCurrentUser } from '@/hooks/use-auth';
import { usePrefetchDashboard } from '@/components/layouts/prefetch-link';
import { cn } from '@/lib/utils';

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
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
