import { apiClient } from '@/services/api/client';
import type {
  Notification,
  NotificationPage,
  NotificationType,
  ReadFilter,
} from '@/features/notifications/types';

export const NOTIFICATION_UNREAD_KEY = ['notifications', 'unread-count'] as const;
export const NOTIFICATION_LIST_KEY = ['notifications', 'list'] as const;

export interface NotificationListParams {
  page?: number;
  size?: number;
  type?: NotificationType | null;
  read?: ReadFilter;
}

/**
 * The caller's own notifications.
 *
 * <p>The filters are sent only when set, so the unfiltered request stays exactly
 * what it was before they existed. `read` is translated to the tri-state the
 * server expects: `all` sends nothing, `unread` sends `read=false`, `read` sends
 * `read=true`.
 */
export async function listNotifications({
  page = 0,
  size = 15,
  type = null,
  read = 'all',
}: NotificationListParams = {}): Promise<NotificationPage> {
  const params: Record<string, string | number> = { page, size };
  if (type) params.type = type;
  if (read === 'unread') params.read = 'false';
  if (read === 'read') params.read = 'true';

  const { data } = await apiClient.get<NotificationPage>('/notifications', { params });
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
