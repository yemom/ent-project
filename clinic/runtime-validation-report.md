# Runtime Validation Report

**Generated**: 2026-10-24T19:35:00+03:00
**Target**: `clinic/backend` and `clinic/frontend`

## Summary

| Step | Status | Exit code | Details |
| --- | --- | ---: | --- |
| Prerequisites | PASS | 0 | Java 21, Maven 3.9.14, Node.js 22.15.1, PostgreSQL 18 available; Docker daemon unavailable |
| Backend tests | PASS | 0 | 317 tests discovered; 316 passed, 0 failures, 0 errors, 1 Docker-gated concurrency test skipped |
| Backend package | PASS | 0 | Spring Boot executable JAR produced |
| PostgreSQL migrations | PASS | 0 | Fresh throwaway PostgreSQL cluster; all 28 Flyway migrations applied; JPA `validate` passed |
| Frontend type-check | PASS | 0 | `tsc --noEmit` |
| Frontend lint | PASS | 0 | 0 errors, 165 warnings |
| Frontend production build | PASS | 0 | 101 static pages generated |
| Backend API E2E | PASS | 0 | All repository checks passed |
| Frontend Playwright E2E | FAIL | 1 | 43 tests collected; 19 passed and 8 failed. The six new proposal tests passed. Eight existing role/admin tests failed because `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` were not set in the environment. |
| Controlled AI provider | PASS | 0 | Local Ollama-compatible HTTP stub returned the expected response; no real Ollama/hosted inference was available |
| AI proposal authorization regression | PASS | 0 | 19 tests, 0 failures, 0 errors, 0 skipped |

**Overall**: BLOCKED

The implementation has strong local backend/build evidence, but the release
gate is blocked by the non-zero full browser-suite result, missing E2E admin
credentials, unexecuted PostgreSQL/Testcontainers concurrency evidence, and
unverified real AI/email integrations.

## Commands and evidence

```text
mvn -f clinic/backend/pom.xml clean test
  exit 0; 317 tests discovered, 316 passed, 0 failures, 0 errors, 1 Docker-gated skip

mvn -f clinic/backend/pom.xml package -DskipTests
  exit 0; executable JAR created

clinic/scripts/verify-migrations.ps1
  exit 0; PostgreSQL v18 throwaway cluster, Flyway v28, Hibernate validate passed

cd clinic/frontend; npm run typecheck
  exit 0

cd clinic/frontend; npm run lint
  exit 0; 165 warnings, 0 errors

cd clinic/frontend; npm run build
  exit 0; 101 pages generated

clinic/backend/e2e-start-and-run.ps1
  exit 0; all API checks passed

cd clinic/frontend; npm run e2e
  exit 1; 43 collected, 19 passed, 8 failed. The proposal tests passed; eight
  existing role/admin tests could not authenticate because
  `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` were unset.

cd clinic/frontend; npx playwright test e2e/ai-appointment-proposals.spec.ts
  exit 0; 6 passed against a running frontend development server with
  browser-level API routing

controlled local Ollama-compatible provider smoke test
  exit 0; capabilities available and chat response matched the controlled response

mvn -f clinic/backend/pom.xml -Dtest=AiAuthorizationTest test
  exit 0; 19 tests, 0 failures, 0 errors, 0 skipped
```

The proposal Playwright spec passed in the full run with browser-level API
routing. This verifies the rendered workflow and action sequencing, but not
live backend persistence. The full suite's failed tests were existing role and
admin scenarios blocked before login because the required credentials were not
loaded. Using `127.0.0.1` instead is expected to fail CORS under the current
exact-origin configuration.

## Database migration results

- Fresh isolated PostgreSQL cluster created on a dynamically selected port.
- Database recreated from empty state.
- Flyway migrations V1 through V28 applied successfully, including the
  PostgreSQL exclusion constraint preventing overlapping active appointments for
  the same doctor.
- JPA schema validation passed after migration.
- No production database was used.
- The script documents recovery for failed Flyway markers; rollback is not
  automated because the migrations are forward-only. Recovery requires
  confirming transactional DDL state and removing only a failed history row.
- Docker/Testcontainers validation was not possible because `docker info`
  reported that the Docker Desktop Linux engine was unavailable. An explicit
  `RUN_POSTGRES_CONCURRENCY_TESTS=true` run exited non-zero when Testcontainers
  could not initialize Docker; the test is now configured to skip cleanly when
  Docker is absent. Local PostgreSQL migration validation passed, but this is
  not evidence of concurrent service-level reservation behavior.

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
- PostgreSQL/Testcontainers concurrent confirmation execution.

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

The new browser spec covers proposal creation, pending-list rendering after
reload, duplicate confirmation protection, rejection, expiry, conflict
feedback, and network/server failure states. It uses deterministic browser
API routing, so live backend persistence, authorization, and database
concurrency remain unverified in browser E2E.

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
- [backend/src/main/resources/db/migration/V28__prevent_overlapping_doctor_appointments.sql](./backend/src/main/resources/db/migration/V28__prevent_overlapping_doctor_appointments.sql):
  added the PostgreSQL exclusion constraint that closes the appointment
  double-booking race.
- [backend/src/test/java/com/clinic/integration/PostgresAppointmentConcurrencyTest.java](./backend/src/test/java/com/clinic/integration/PostgresAppointmentConcurrencyTest.java):
  added Docker-gated PostgreSQL concurrency evidence; it skips when Docker is
  unavailable and must be executed in a Docker-enabled staging environment.
- [frontend/e2e/ai-appointment-proposals.spec.ts](./frontend/e2e/ai-appointment-proposals.spec.ts):
  added six browser workflow tests for proposal lifecycle and failure states.

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
coverage exercises persisted create/confirm/reject behavior against the
backend. The full browser suite must also be rerun with valid staging
credentials. Concurrent confirmation against PostgreSQL/Testcontainers, a real
Ollama/hosted provider, and production email delivery are also not verified.

No secret values are recorded in this report.
