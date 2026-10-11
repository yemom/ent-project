export * from './components/lab-order-form';
export * from './components/lab-order-card';
export * from './components/lab-order-list';
export * from './components/lab-result-form';
export * from './components/lab-result-view';
export * from './hooks/use-lab-orders';
export * from './hooks/use-lab-results';
export * from './services/lab-orders.service';
export * from './services/lab-results.service';
// Lab notifications now live in @/features/notifications (the generalised
// Notification entity). The legacy lab-only bell and hooks remain for
// compatibility but are no longer rendered by the app shell.
export * from './hooks/use-lab-notifications';
export * from './services/lab-notifications.service';
export * from './types';
