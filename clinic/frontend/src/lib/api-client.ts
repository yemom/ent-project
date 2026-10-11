/**
 * Backwards-compatible re-export of the shared API client.
 *
 * The retry / wake-up / refresh logic now lives in a single place
 * (`@/services/api/client`) so every caller gets the same behaviour.
 * This file previously held a divergent duplicate client with its own
 * interceptors, which meant only this import got token refresh.
 */
export { default } from '@/services/api/client';
export {
  apiClient,
  wakeUpServer,
  isServerAwake,
  subscribeServerStatus,
  isWakeUpFailure,
  API_TIMEOUT_MS,
  COLD_START_TIMEOUT_MS,
  TRANSIENT_STATUS_CODES,
} from '@/services/api/client';