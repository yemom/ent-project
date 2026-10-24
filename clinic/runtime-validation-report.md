# Runtime Validation Report

**Generated**: 2026-10-24T17:45:00+03:00
**Target**: `clinic/backend` and `clinic/frontend`

## Summary

| Step | Status | Exit code | Details |
| --- | --- | ---: | --- |
| Prerequisites | PASS | 0 | Java 21, Maven 3.9.14, Node.js 22.15.1, PostgreSQL 18 available; Docker daemon unavailable |
| Backend tests | PASS | 0 | 315 tests, 0 failures, 0 errors, 0 skipped |
| Backend package | PASS | 0 | Spring Boot executable JAR produced |
| PostgreSQL migrations | PASS | 0 | Fresh throwaway PostgreSQL cluster; all 27 Flyway migrations applied; JPA `validate` passed |
| Frontend type-check | PASS | 0 | `tsc --noEmit` |
| Frontend lint | PASS | 0 | 0 errors, 165 warnings |
| Frontend production build | PASS | 0 | 101 static pages generated |
| Backend API E2E | PASS | 0 | All repository checks passed |
| Frontend Playwright E2E | PASS | 0 | 37 tests passed |
| Controlled AI provider | PASS | 0 | Local Ollama-compatible stub returned the expected response |
| AI proposal authorization regression | PASS | 0 | 19 tests, 0 failures, 0 errors, 0 skipped |

**Overall**: NEEDS SIGNOFF

The application is suitable for staging validation. Production signoff remains
blocked until a real deployment validates its configured AI provider, email
delivery, secrets, and frontend proposal workflow.

## Commands and evidence

```text
mvn -f clinic/backend/pom.xml clean test
  exit 0; 315 tests, 0 failures, 0 errors, 0 skipped

mvn -f clinic/backend/pom.xml package -DskipTests
  exit 0; executable JAR created

clinic/scripts/verify-migrations.ps1
  exit 0; PostgreSQL v18 throwaway cluster, Flyway v27, Hibernate validate passed

cd clinic/frontend; npm run typecheck
  exit 0

cd clinic/frontend; npm run lint
  exit 0; 165 warnings, 0 errors

cd clinic/frontend; npm run build
  exit 0; 101 pages generated

clinic/backend/e2e-start-and-run.ps1
  exit 0; all API checks passed

cd clinic/frontend; npm run e2e
  exit 0; 37 passed

controlled local Ollama-compatible provider smoke test
  exit 0; capabilities available and chat response matched the controlled response

mvn -f clinic/backend/pom.xml -Dtest=AiAuthorizationTest test
  exit 0; 19 tests, 0 failures, 0 errors, 0 skipped
```

The Playwright suite was run against the standalone server entry point with the
allowed `localhost` origin. Using `127.0.0.1` instead is expected to fail CORS
under the current exact-origin configuration.

## Database migration results

- Fresh isolated PostgreSQL cluster created on a dynamically selected port.
- Database recreated from empty state.
- Flyway migrations V1 through V27 applied successfully.
- JPA schema validation passed after migration.
- No production database was used.
- The script documents recovery for failed Flyway markers; rollback is not
  automated because the migrations are forward-only. Recovery requires
  confirming transactional DDL state and removing only a failed history row.
- Docker/Testcontainers validation was not possible because `docker info`
  reported that the daemon was unavailable. Local PostgreSQL provided the
  equivalent migration validation for this run.

## AI-provider results and limitations

Verified:

- Disabled-provider and unavailable-provider behavior in `AiAuthorizationTest`.
- OpenAI-compatible request, response, malformed-response, and limit behavior in
  `OpenAiCompatibleProviderTest`.
- Role authorization, conversation ownership, pending-action ownership, and
  unavailable-state handling.
- A controlled local Ollama-compatible HTTP provider returned a real backend
  response through the configured provider adapter.
- Provider credentials remained server-side.

Not verified:

- A real Ollama model or hosted provider.
- Provider latency under production network conditions.
- Production token/account quotas.
- Actual email delivery.

## Role and workflow coverage

The backend API E2E suite covered Super Admin, doctor, patient, nurse,
laboratory technician, pharmacist, cashier, receptionist/front desk, and
hospital administrator behavior, including:

- authentication and account lifecycle;
- role-specific redirects and forbidden operations;
- patient registration and assignment;
- appointments and conflicts;
- medical records and nursing observations;
- prescriptions and pharmacy inventory;
- laboratory critical results;
- billing, payments, receipts, and overpayment rejection;
- notifications and audit records.

The browser suite covered:

- Super Admin;
- doctor;
- patient;
- nurse;
- pharmacist;
- cashier;
- receptionist;
- laboratory technician;
- hospital administrator;
- route guards, sidebar navigation, account lifecycle, and reception
  appointment loading, empty, error, booking, conflict, cancellation, and
  responsive states.

The backend exposes typed AI appointment proposal endpoints and the client has
confirmation/rejection API functions. The browser UI now provides typed booking
proposal creation, pending-proposal retrieval, detailed status display, explicit
confirmation/rejection, refresh reconciliation, and duplicate-click protection.
The backend also checks proposal permissions at creation time, constrains patient
callers to their own booking proposals, and re-checks permissions at confirmation.

Browser-level create/confirm/reject/expire/conflict/concurrent-confirmation
coverage remains a release gap rather than an asserted pass.

## Fixes made during this validation

- [frontend/package.json](./frontend/package.json): production `start` now
  executes the generated standalone server.
- [frontend/scripts/dev-e2e.mjs](./frontend/scripts/dev-e2e.mjs): E2E now runs
  the standalone server and copies `public` plus the active dist directory's
  static assets into the standalone artifact.
- [frontend/next.config.mjs](./frontend/next.config.mjs): comments now describe
  standalone deployment accurately.
- [frontend/src/features/ai/ai-assistant-panel.tsx](./frontend/src/features/ai/ai-assistant-panel.tsx):
  added the typed appointment-proposal form, pending-proposal list, explicit
  confirm/reject controls, refresh reconciliation, and terminal/error states.
- [backend/src/main/java/com/clinic/ai/AiActionService.java](./backend/src/main/java/com/clinic/ai/AiActionService.java):
  added server-side proposal permission checks and patient ownership validation.
- [backend/src/test/java/com/clinic/security/AiAuthorizationTest.java](./backend/src/test/java/com/clinic/security/AiAuthorizationTest.java):
  added regression coverage for unauthorized proposal creation.

## Deployment blockers and required variables

Before production:

- Configure `SPRING_DATASOURCE_URL`,
  `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD`.
- Configure a unique base64 `APP_JWT_SECRET` of at least 64 bytes.
- Configure `CORS_ALLOWED_ORIGINS` with exact production frontend origins.
- Configure all `SUPER_ADMIN_*` bootstrap values.
- Configure `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`,
  `MAIL_FROM`, and TLS settings if password reset/email is enabled.
- Configure `AI_ENABLED`, `AI_PROVIDER`, `AI_API_URL`, `AI_MODEL`, and
  `AI_API_KEY` for hosted providers; also configure timeout, limits,
  `AI_ALLOW_IDENTIFIABLE_DATA`, and `AI_ALLOWED_HOSTS`.
- Configure `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_APP_URL`.
- Confirm production uses `node server.js` from the standalone artifact, as the
  Dockerfile does.

The proposal workflow remains blocked from production signoff until browser
coverage exercises persisted create/confirm/reject behavior, expiry and
conflict handling, and concurrent confirmation against PostgreSQL. A real
Ollama/hosted provider and production email delivery are also not verified.

No secret values are recorded in this report.
