export { NotificationBell, default } from '@/features/notifications/components/notification-bell';
export { NotificationsPage } from '@/features/notifications/components/notifications-page';
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
export type { NotificationListParams } from '@/features/notifications/services/notifications.service';
export {
  FILTERABLE_NOTIFICATION_TYPES,
  type Notification,
  type NotificationPage,
  type NotificationType,
  type ReadFilter,
} from '@/features/notifications/types';