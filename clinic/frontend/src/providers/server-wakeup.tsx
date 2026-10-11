'use client';

import { useEffect } from 'react';
import { wakeUpServer } from '@/services/api/client';

/**
 * Fire-and-forget liveness ping on app load.
 *
 * Render's free tier spins down idle containers; the first request after a
 * spin-down then has to wait for a cold boot. Pinging the DB-free `/health`
 * endpoint as soon as the app mounts pays that cost before the user submits
 * the login form. Never renders anything and never throws.
 */
export function ServerWakeUp() {
  useEffect(() => {
    void wakeUpServer();
  }, []);

  return null;
}

export default ServerWakeUp;