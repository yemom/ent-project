import { Suspense } from 'react';
import { LoginPage } from '@/features/auth/auth-pages';

/**
 * `LoginPage` reads the `?reset=1` query parameter to confirm a completed password
 * reset. `useSearchParams` is a client hook with no value during prerender, so it
 * needs a Suspense boundary or the route fails to build.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}