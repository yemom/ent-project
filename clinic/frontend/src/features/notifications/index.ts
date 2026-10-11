export { NotificationBell, default } from '@/features/notifications/components/notification-bell';
export {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useNotificationStream,
} from '@/features/notifications/hooks/use-notifications';
export {
  notificationsService,
  listNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/features/notifications/services/notifications.service';
export type { Notification, NotificationPage, NotificationType } from '@/features/notifications/types';