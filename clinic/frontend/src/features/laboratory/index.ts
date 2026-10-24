export * from './components/lab-order-form';
export * from './components/lab-order-card';
export * from './components/lab-order-list';
export * from './components/lab-result-form';
export * from './components/lab-result-view';
export * from './hooks/use-lab-orders';
export * from './hooks/use-lab-results';
export * from './services/lab-orders.service';
export * from './services/lab-results.service';
// Notifications live in @/features/notifications. The lab-only bell, hook and
// service were removed rather than left "for compatibility": they were never
// rendered, and the API they called took a userId from the client, so any
// authenticated lab role could read another user's notification list through it.
// Keeping an unused, unscoped endpoint alive is not compatibility — it is a hole.
export * from './types';
