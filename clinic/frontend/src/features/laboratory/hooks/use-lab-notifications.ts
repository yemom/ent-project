'use client';

import { useEffect, useState } from 'react';
import { labNotificationsService } from '../services/lab-notifications.service';
import { getFriendlyErrorMessage } from '@/lib/error-handler';
import type { LabNotification } from '../types';

export function useLabNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<LabNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchNotifications() {
      if (!userId) {
        setNotifications([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await labNotificationsService.list({ userId });
        if (!mounted) return;
        setNotifications(data.content ?? []);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(getFriendlyErrorMessage(err, 'Could not load notifications'));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchNotifications();

    const intervalId = userId
      ? window.setInterval(() => {
          void fetchNotifications();
        }, 30000)
      : undefined;

    return () => {
      mounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [userId]);

  const markRead = async (id: string) => {
    await labNotificationsService.markRead(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, isLoading, error, markRead, unreadCount };
}
