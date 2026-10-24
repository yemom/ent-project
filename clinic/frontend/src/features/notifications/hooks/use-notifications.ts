'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { env } from '@/lib/env';
import {
  NOTIFICATION_LIST_KEY,
  NOTIFICATION_UNREAD_KEY,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationListParams,
} from '@/features/notifications/services/notifications.service';

/** Polling cadence for the fallback path when SSE is not connected. */
const POLL_INTERVAL_MS = 30_000;

/**
 * Server-Sent Events subscription.
 *
 * SSE (not WebSocket) because it is a plain HTTP response: it survives Render's
 * proxying and needs no sticky session or extra socket layer. The polling in
 * the hooks below is the fallback when SSE is unavailable.
 *
 * The listener is held in a ref so a re-render never tears down the stream.
 */
export function useNotificationStream(onEvent: () => void) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const base = env.apiBaseUrl.replace(/\/api\/v1$/, '');
    // EventSource cannot set an Authorization header, so the token goes in the query string.
    const url = `${base}/api/v1/notifications/stream?token=${encodeURIComponent(accessToken)}`;
    const source = new EventSource(url);

    const handle = () => handlerRef.current();
    source.addEventListener('notification', handle);
    source.addEventListener('message', handle);

    return () => {
      source.removeEventListener('notification', handle);
      source.removeEventListener('message', handle);
      source.close();
    };
  }, [accessToken, isAuthenticated]);
}

/**
 * Unread badge count. Polls as a fallback so the count stays correct even if the
 * SSE stream drops (common behind Render proxies / sleeping tabs).
 */
export function useUnreadCount() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const query = useQuery({
    queryKey: NOTIFICATION_UNREAD_KEY,
    queryFn: async () => {
      const { notificationsService } = await import('@/features/notifications/services/notifications.service');
      return notificationsService.unreadCount();
    },
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });

  const refetch = query.refetch;
  useNotificationStream(useCallback(() => void refetch(), [refetch]));

  return query;
}

/**
 * The notification list, filtered and paginated.
 *
 * <p>The page and filters are part of the query key rather than applied after the
 * response, so switching a filter fetches a different cached result instead of
 * refetching the whole list and hiding the difference.
 *
 * <p>Both the dropdown and the full page use this, so the bell and the page share
 * one cache entry for the same filter — marking a notification read in the dropdown
 * updates the page too.
 */
export function useNotifications({
  page = 0,
  size = 15,
  type = null,
  read = 'all',
}: NotificationListParams = {}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const query = useQuery({
    queryKey: [...NOTIFICATION_LIST_KEY, page, size, type, read] as const,
    queryFn: () => listNotifications({ page, size, type, read }),
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 15_000,
    // Keeps the previous page visible while the next one loads, so paging does not
    // collapse the list into a skeleton.
    placeholderData: (previous) => previous,
  });

  const refetch = query.refetch;
  useNotificationStream(useCallback(() => void refetch(), [refetch]));

  return query;
}

/**
 * Marks one notification read, updating the cache optimistically.
 *
 * <p>The unread badge is only decremented when the row was actually unread.
 * Decrementing unconditionally would let a second call on an already-read row
 * silently shrink the badge below the true count, and nothing would correct it
 * until the next poll — the badge and the list would then disagree with the
 * server. The guard reads the cached copy rather than taking the caller at its
 * word, so it does not depend on every call site checking first.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useCallback(
    async (id: string) => {
      let wasUnread = false;

      queryClient.setQueriesData({ queryKey: NOTIFICATION_LIST_KEY }, (current: unknown) => {
        const page = current as { content?: Array<{ id: string; readAt: string | null }> } | undefined;
        if (!page?.content) return current;
        const target = page.content.find((item) => item.id === id);
        if (target && !target.readAt) wasUnread = true;
        return {
          ...page,
          content: page.content.map((item) =>
            item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item
          ),
        };
      });

      if (wasUnread) {
        queryClient.setQueryData(NOTIFICATION_UNREAD_KEY, (current: number | undefined) =>
          typeof current === 'number' ? Math.max(0, current - 1) : current
        );
      }

      try {
        await markNotificationRead(id);
      } finally {
        // Re-read from the server either way, so a rejected call cannot leave an
        // optimistic badge in place.
        void queryClient.invalidateQueries({ queryKey: NOTIFICATION_UNREAD_KEY });
      }
    },
    [queryClient]
  );
}

/**
 * Marks everything read and returns how many rows the server actually changed.
 *
 * <p>The count is passed back rather than discarded: the caller reports "12 marked"
 * instead of an unquantified success, and `0` is distinguishable from a request
 * that never arrived — which a bare `Promise<void>` cannot express.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    queryClient.setQueryData(NOTIFICATION_UNREAD_KEY, 0);
    queryClient.setQueriesData({ queryKey: NOTIFICATION_LIST_KEY }, (current: unknown) => {
      const page = current as { content?: Array<{ id: string; readAt: string | null }> } | undefined;
      if (!page?.content) return current;
      const readAt = new Date().toISOString();
      return { ...page, content: page.content.map((item) => ({ ...item, readAt })) };
    });
    return markAllNotificationsRead();
  }, [queryClient]);
}