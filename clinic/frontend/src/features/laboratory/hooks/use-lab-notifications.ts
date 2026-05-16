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
    async function fetch() {
      try {
        setIsLoading(true);
        const data = await labNotificationsService.list({ userId });
        if (!mounted) return;
        setNotifications(data.content ?? []);
        setError(null);
      } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Could not load notifications'));
      } finally {
        setIsLoading(false);
      }
    }
    if (userId) fetch();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const markRead = async (id: string) => {
    await labNotificationsService.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, isLoading, error, markRead, unreadCount };
}
