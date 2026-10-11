import type { AuthTokens, AuthUser } from '@/types/api';

/**
 * Auth session shape and normalisation.
 *
 * <p>Deliberately separate from `services/api/auth.ts`. That module builds the
 * axios client, and `client.ts` needs this logic too -- so putting it there would
 * make the two import each other in a cycle. This module has no runtime imports at
 * all, which makes it safe to pull into either side.
 */

/**
 * The raw login / register / refresh payload.
 *
 * <p>`permissions` sits at the TOP LEVEL, next to `user`, not inside it. That
 * mirrors `AuthResponse` on the server.
 *
 * <p>Declaring only `{ user }` used to make TypeScript drop the field at the type
 * boundary, so the stored user carried no permissions and every consumer quietly
 * fell back to a locally mirrored permission matrix. That fallback usually agreed
 * with the server, which is exactly why the bug survived: it only surfaced when the
 * mirror and the real matrix drifted apart.
 */
export interface AuthResponse extends AuthTokens {
  user: AuthUser;
  permissions: string[];
}

/**
 * Folds the top-level `permissions` onto the user, which is where the store keeps
 * them and where every consumer reads them.
 *
 * <p>A missing or malformed list becomes an empty array rather than undefined, so
 * `hasPermission` reliably falls back to the role matrix instead of throwing on
 * `undefined.includes(...)`.
 */
export function toSession(
  response: AuthResponse
): AuthTokens & { user: AuthUser } {
  const permissions = Array.isArray(response.permissions) ? response.permissions : [];

  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    tokenType: response.tokenType,
    expiresAt: response.expiresAt,
    user: { ...response.user, permissions },
  };
}
