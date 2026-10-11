import { apiClient } from '@/services/api/client';
import type { Notification, NotificationPage } from '@/features/notifications/types';

export const NOTIFICATION_UNREAD_KEY = ['notifications', 'unread-count'] as const;
export const NOTIFICATION_LIST_KEY = ['notifications', 'list'] as const;

export async function listNotifications(page = 0, size = 15): Promise<NotificationPage> {
  const { data } = await apiClient.get<NotificationPage>('/notifications', {
    params: { page, size },
  });
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await apiClient.get<number>('/notifications/unread-count');
  return data ?? 0;
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await apiClient.patch<Notification>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await apiClient.patch<number>('/notifications/read-all');
  return data ?? 0;
}

export const notificationsService = {
  list: listNotifications,
  unreadCount: fetchUnreadCount,
  markRead: markNotificationRead,
  markAllRead: markAllNotificationsRead,
};

export default notificationsService;