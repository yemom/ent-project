import apiClient from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type { LabNotification } from '../types';

export const labNotificationsService = {
  list: (params?: Record<string, any>) => apiClient.get<PageResponse<LabNotification>>('/api/lab-notifications', { params }).then((r) => r.data),
  unreadCount: (userId: string) => apiClient.get<number>(`/api/lab-notifications/unread-count/${userId}`).then((r) => r.data),
  markRead: (id: string) => apiClient.patch<LabNotification>(`/api/lab-notifications/${id}/read`, { isRead: true }).then((r) => r.data)
};
