'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Menu,
  MoonStar,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  LogOut,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { GlobalSearch } from '@/components/layouts/global-search';
import { useAuthStore } from '@/store/auth-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopbarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenMobile?: () => void;
}

export function Topbar({ collapsed, onToggleCollapse, onOpenMobile }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  // Generate breadcrumb parts from pathname
  const pathSegments = pathname
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      const formatted = seg.replace(/[-_]/g, ' ');
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    });

  const pageTitle = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : 'Dashboard';

  const initial = (user?.fullName?.trim().charAt(0) || 'U').toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-border/60 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      {/* Left section: toggles and breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMobile}
          className="lg:hidden text-muted-foreground hover:text-foreground"
          aria-label="Open mobile navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Desktop Collapse Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="hidden lg:flex text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <Link href="/" className="hover:text-foreground transition-colors">
            Clinic Care
          </Link>
          {pathSegments.map((segment, index) => {
            const isLast = index === pathSegments.length - 1;
            return (
              <React.Fragment key={index}>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className={isLast ? 'font-medium text-foreground' : 'hover:text-foreground'}>
                  {segment}
                </span>
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right section: Search, Notifications, Theme toggle, User */}
      <div className="flex items-center gap-2 sm:gap-3">
        <GlobalSearch />

        <NotificationBell />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <MoonStar className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <div className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
            {initial}
          </div>
          <div className="hidden leading-tight lg:block">
            <p className="max-w-32 truncate text-xs font-semibold text-foreground">{user?.fullName || 'User'}</p>
            <p className="text-[10px] uppercase tracking-wide text-primary">{user?.role?.replace(/_/g, ' ') || 'USER'}</p>
          </div>
        </div>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-sm">
                {initial}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-foreground">{user?.fullName || 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {user?.role}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/patient/profile" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profile & Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
