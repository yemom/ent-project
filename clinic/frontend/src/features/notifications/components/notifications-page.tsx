'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellOff, CheckCheck, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layouts/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/hooks/use-notifications';
import {
  FILTERABLE_NOTIFICATION_TYPES,
  type Notification,
  type NotificationType,
  type ReadFilter,
} from '@/features/notifications/types';
import { getFriendlyErrorMessage } from '@/lib/error-handler';

const PAGE_SIZE = 20;

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

const READ_FILTERS: Array<{ value: ReadFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

function typeLabel(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase();
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * The full notification history.
 *
 * <p>One screen for every role, served by the same owner-scoped endpoint the bell
 * uses. The server decides what each caller can see; this page only narrows within
 * what it already returned.
 *
 * <p>Filtering is server-side rather than client-side on purpose. An unread badge
 * that counts the whole table but shows a filtered slice would disagree with
 * itself, and a client-side filter over one page would silently omit rows the
 * reader believed they were looking at.
 */
export function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [type, setType] = useState<NotificationType | ''>('');
  const [read, setRead] = useState<ReadFilter>('all');

  const query = useNotifications({
    page,
    size: PAGE_SIZE,
    type: type === '' ? null : type,
    read,
  });
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = query.data?.content ?? [];
  const totalElements = query.data?.totalElements ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
  const hasFilters = type !== '' || read !== 'all';

  function resetFilters() {
    setType('');
    setRead('all');
    setPage(0);
  }

  async function handleMarkAll() {
    try {
      const marked = await markAllRead();
      toast.success(
        marked > 0 ? `${marked} notification${marked === 1 ? '' : 's'} marked as read.` : 'Nothing left to mark as read.',
      );
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error, 'We could not mark your notifications as read.'));
    }
  }

  async function handleOpen(notification: Notification) {
    // Mark first, then navigate: the badge should be correct by the time the user
    // arrives at the record, and a failure to navigate must not lose the read state.
    if (!notification.read) {
      try {
        await markRead(notification.id);
      } catch (error) {
        toast.error(getFriendlyErrorMessage(error, 'We could not mark that notification as read.'));
      }
    }
    if (notification.link) {
      router.push(notification.link);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Everything the hospital has sent to your account."
        actionLabel={unread.data && unread.data > 0 ? 'Mark all read' : undefined}
        onAction={unread.data && unread.data > 0 ? () => void handleMarkAll() : undefined}
      />

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Your notifications</CardTitle>
              <CardDescription>
                {query.isLoading
                  ? 'Loading notifications…'
                  : `${totalElements} notification${totalElements === 1 ? '' : 's'}${
                      hasFilters ? ' match your filters' : ''
                    }`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
                aria-label="Refresh notifications"
                title="Refresh"
              >
                {query.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="notification-filter-type">Category</Label>
              <Select
                id="notification-filter-type"
                value={type}
                onChange={(event) => {
                  setType(event.target.value as NotificationType | '');
                  setPage(0);
                }}
              >
                <option value="">All categories</option>
                {FILTERABLE_NOTIFICATION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notification-filter-read">Status</Label>
              <Select
                id="notification-filter-read"
                value={read}
                onChange={(event) => {
                  setRead(event.target.value as ReadFilter);
                  setPage(0);
                }}
              >
                {READ_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            {hasFilters ? (
              <div className="flex items-end md:col-span-2">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          {query.isError ? (
            <ErrorState
              title="Notifications could not be loaded"
              message={getFriendlyErrorMessage(
                query.error,
                'We could not reach the notification service. Please try again.',
              )}
              onRetry={() => void query.refetch()}
            />
          ) : query.isLoading ? (
            <div className="space-y-3" aria-hidden>
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-xl" />
              ))}
              <span className="sr-only">Loading notifications…</span>
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              hasFilters={hasFilters}
              unreadCount={unread.data ?? 0}
              onReset={resetFilters}
              onMarkAll={() => void handleMarkAll()}
            />
          ) : (
            <>
              <ul className="space-y-3">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <NotificationRow
                      notification={notification}
                      onOpen={() => void handleOpen(notification)}
                      onMarkRead={() => void markRead(notification.id)}
                    />
                  </li>
                ))}
              </ul>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(0, current - 1))}
                      disabled={page === 0 || query.isFetching}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                      disabled={page >= totalPages - 1 || query.isFetching}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationRow({
  notification,
  onOpen,
  onMarkRead,
}: {
  notification: Notification;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  const unread = !notification.read;

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start sm:justify-between ${
        unread ? 'border-primary/30 bg-primary/5' : 'border-border bg-background'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{notification.title}</p>
          <Badge className={`text-[10px] ${TYPE_BADGES[notification.type as NotificationType] ?? 'bg-muted text-muted-foreground'}`}>
            {typeLabel(notification.type)}
          </Badge>
          {unread ? <Badge variant="destructive">New</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatTimestamp(notification.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {notification.link ? (
          <Button variant="outline" size="sm" onClick={onOpen}>
            View
          </Button>
        ) : null}
        {unread ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkRead}
            aria-label={`Mark "${notification.title}" as read`}
          >
            <CheckCheck className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1.5">Mark read</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  unreadCount,
  onReset,
  onMarkAll,
}: {
  hasFilters: boolean;
  unreadCount: number;
  onReset: () => void;
  onMarkAll: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-12 text-center">
      {hasFilters ? (
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      ) : unreadCount > 0 ? (
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      ) : (
        <BellOff className="h-8 w-8 text-muted-foreground" aria-hidden />
      )}
      <div>
        <p className="font-medium">
          {hasFilters ? 'No notifications match your filters' : 'No notifications yet'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasFilters
            ? 'Try a different category, or switch the status back to All.'
            : 'When something needs your attention it will appear here.'}
        </p>
      </div>
      {hasFilters ? (
        <Button variant="outline" onClick={onReset}>
          Clear filters
        </Button>
      ) : unreadCount > 0 ? (
        <Button variant="outline" onClick={onMarkAll}>
          <CheckCheck className="h-4 w-4" /> Mark all read
        </Button>
      ) : null}
    </div>
  );
}

export default NotificationsPage;
