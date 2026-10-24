'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/hooks/use-notifications';
import type { NotificationType } from '@/features/notifications/types';

/**
 * Badge colour per notification category.
 *
 * <p>Grouped by workflow rather than by colour: scheduling, pharmacy and
 * laboratory each keep one hue so a reader learns "amber means scheduling" instead
 * of re-reading every badge. Categories added later fall through to the muted
 * default rather than crashing, which is why the lookup is total over a widened
 * {@link NotificationType}.
 */
const TYPE_BADGES: Record<NotificationType, string> = {
  APPOINTMENT_CREATED: 'bg-amber-100 text-amber-700',
  APPOINTMENT_RESCHEDULED: 'bg-amber-100 text-amber-700',
  APPOINTMENT_CANCELLED: 'bg-amber-100 text-amber-700',
  APPOINTMENT_STATUS_CHANGED: 'bg-amber-100 text-amber-700',
  APPOINTMENT_REMINDER: 'bg-amber-100 text-amber-700',
  PRESCRIPTION_CREATED: 'bg-emerald-100 text-emerald-700',
  PRESCRIPTION_STATUS_CHANGED: 'bg-emerald-100 text-emerald-700',
  PRESCRIPTION_READY: 'bg-emerald-100 text-emerald-700',
  LAB_ORDER_CREATED: 'bg-sky-100 text-sky-700',
  LAB_RESULT_READY: 'bg-teal-100 text-teal-700',
  PATIENT_ASSIGNED: 'bg-violet-100 text-violet-700',
  SYSTEM: 'bg-muted text-muted-foreground',
};

const DEFAULT_BADGE = 'bg-muted text-muted-foreground';

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  return date.toLocaleDateString();
}

/**
 * Bell + unread badge + dropdown, rendered in every role layout by AppShell.
 * Opens the related record when a notification is clicked.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: unreadCount = 0, isLoading: countLoading } = useUnreadCount();
  // Unread only: the dropdown is a triage list. The full page is where history
  // and the other filters live.
  const { data: page, isLoading: listLoading } = useNotifications({ size: 10, read: 'unread' });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleClick = async (id: string, link: string | null) => {
    await markRead(id);
    setOpen(false);
    if (link) router.push(link);
  };

  const notifications = page?.content ?? [];

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-5 w-5" />
        {countLoading && unreadCount === 0 ? (
          <Loader2 className="absolute h-3 w-3 animate-spin" />
        ) : null}
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border/60 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              </p>
            </div>
            {unreadCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {listLoading && notifications.length === 0 ? (
              <div className="space-y-2 p-4">
                <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => {
                const unread = !notification.readAt;
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void handleClick(notification.id, notification.link)}
                    className={`flex w-full flex-col gap-1 border-b border-border/40 px-4 py-3 text-left transition hover:bg-muted/60 ${
                      unread ? 'bg-primary/5' : 'opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{notification.title}</span>
                      <Badge
                        className={`text-[10px] ${
                          TYPE_BADGES[notification.type as NotificationType] ?? DEFAULT_BADGE
                        }`}
                      >
                        {notification.type.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    </div>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {notification.message}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatWhen(notification.createdAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/*
            The dropdown is a ten-row triage list. Without this there is no way to
            reach older notifications, the per-category filters, or pagination —
            the three things the full page exists for.
          */}
          <div className="border-t border-border/60 p-2">
            <NextLink
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-center text-xs font-medium text-primary hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View all notifications
            </NextLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default NotificationBell;