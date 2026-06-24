import axios from 'axios';
import { toUserFacingError } from '@/lib/error-handler';
import { useAuthStore } from '@/store/auth-store';
import type { PageResponse } from '@/types/api';
import type { LabNotification } from '../types';

const LAB_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/api\/v1$/, '');

function getAuthHeader() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const labNotificationsService = {
  list: (params?: Record<string, any>) => axios.get<PageResponse<LabNotification>>(`${LAB_BASE}/api/lab-notifications`, {
    params,
    headers: { ...getAuthHeader() },
    withCredentials: true
  }).then((r) => r.data).catch((err) => {
    throw toUserFacingError(err, 'Could not load lab notifications.');
  }),
  unreadCount: (userId: string) => axios.get<number>(`${LAB_BASE}/api/lab-notifications/unread-count/${userId}`, {
    headers: { ...getAuthHeader() },
    withCredentials: true
  }).then((r) => r.data).catch((err) => {
    throw toUserFacingError(err, 'Could not load unread notification count.');
  }),
  markRead: (id: string) => axios.patch<LabNotification>(`${LAB_BASE}/api/lab-notifications/${id}/read`, { isRead: true }, {
    headers: { ...getAuthHeader() },
    withCredentials: true
  }).then((r) => r.data).catch((err) => {
    throw toUserFacingError(err, 'Could not mark the notification as read.');
  })
};
