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

/** Recent notifications for the dropdown. */
export function useNotifications(page = 0, size = 15) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const query = useQuery({
    queryKey: [...NOTIFICATION_LIST_KEY, page, size] as const,
    queryFn: () => listNotifications(page, size),
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 15_000,
  });

  const refetch = query.refetch;
  useNotificationStream(useCallback(() => void refetch(), [refetch]));

  return query;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useCallback(
    async (id: string) => {
      // Optimistic: the bell should feel instant.
      queryClient.setQueryData(NOTIFICATION_UNREAD_KEY, (current: number | undefined) =>
        typeof current === 'number' ? Math.max(0, current - 1) : current
      );
      queryClient.setQueriesData({ queryKey: NOTIFICATION_LIST_KEY }, (current: unknown) => {
        const page = current as { content?: Array<{ id: string; readAt: string | null }> } | undefined;
        if (!page?.content) return current;
        return {
          ...page,
          content: page.content.map((item) =>
            item.id === id ? { ...item, readAt: new Date().toISOString() } : item
          ),
        };
      });

      try {
        await markNotificationRead(id);
      } finally {
        void queryClient.invalidateQueries({ queryKey: NOTIFICATION_UNREAD_KEY });
      }
    },
    [queryClient]
  );
}

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
    await markAllNotificationsRead();
  }, [queryClient]);
}