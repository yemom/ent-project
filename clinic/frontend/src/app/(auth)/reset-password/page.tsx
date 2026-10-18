import { Suspense } from 'react';
import { ResetPasswordPage } from '@/features/auth/auth-pages';

/**
 * The reset token arrives in the query string, which Next.js can only read on the
 * client. `useSearchParams` therefore has to sit inside a Suspense boundary or the
 * route fails to prerender.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPage />
    </Suspense>
  );
}