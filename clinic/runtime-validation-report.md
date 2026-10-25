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

## CliniCel AI workspace update (2026-10-25, follow-up)

**Status**: PARTIALLY IMPLEMENTED. The dedicated workspace now includes a real,
role-scoped appointment history series, a limited deterministic baseline, a
measured comparison insight, date filters, and server-persisted conversation
selection. The original endpoint remains available for role-specific operational
facts. No fabricated values or prediction bounds are used.

### Verified API and data mapping

| UI feature | API endpoint | Data source / repository path | Permission | Evidence |
| --- | --- | --- | --- | --- |
| Capability and availability status | `GET /api/v1/ai/capabilities` | `AiService.availability()` and `AiCapabilityService.availableCapabilities()` | Authenticated caller; capabilities derived from current server principal and role permissions | Controller and service source inspection |
| Operational snapshot | `GET /api/v1/ai/forecast` | `AiCapabilityService.operationalForecast()`; role-specific appointment, assignment, lab, pharmacy, or billing repositories | `OPERATIONAL_FORECAST` permission checked server-side | Controller, service, and capability source inspection |
| Dated appointment series, baseline, measured comparison insight | `GET /api/v1/ai/forecast/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD` | `AppointmentRepository.dailyAppointmentSeries` groups non-deleted persisted `appointments.appointment_date`; patient/doctor filters use their principal ID | `OPERATIONAL_FORECAST` checked server-side; hospital-wide scope only for roles with appointment/report permission; doctor and patient scopes are owner-only | `AiAuthorizationTest`: range validation, insufficient history, patient isolation, and baseline output |
| Assistant answer | `POST /api/v1/ai/chat` | Capability service executes authorized repository/service reads; provider only verbalizes supplied facts | Capability allow-list and current-user permissions rechecked server-side; owned conversation IDs | `AiController.chat`, `AiService.chat`, `AiCapabilityService.execute` |
| Conversation history | `GET /api/v1/ai/conversations`, `GET /api/v1/ai/conversations/{id}` | Owner-scoped conversation and message repositories | Caller ownership enforced; foreign conversation returns 404 | Controller source inspection; UI currently does not browse history |
| Appointment proposal | `POST /api/v1/ai/actions/propose`, `GET /api/v1/ai/actions/pending`, `POST /api/v1/ai/actions/{id}/confirm`, `POST /api/v1/ai/actions/{id}/reject` | Persisted `AiPendingAction` and appointment records | Creation, ownership, expiry, permission, availability, and concurrency rechecked server-side; explicit human confirmation | Existing tests and prior Playwright evidence documented above |

The original forecast response is `facts`, `sources`, and `computedAt`. The new
series endpoint returns daily actual points, 7 daily baseline estimates when
history is sufficient, method, observation count, scope, source range, timestamp,
limitations, and measured 14-day comparison insight. Forecasting uses the rounded
mean of the last seven calendar-day counts, repeated for seven future days. It is
not a validated predictive model; no prediction interval is computed. At least
28 calendar days and 7 nonzero days are required. Ranges are limited to 366 days,
cannot extend past today, and reject reversed dates. Unsupported roles receive an
explicit unavailable-history response without a hospital aggregate. The query
returns daily counts only and never selects patient identities.

The AI workspace includes a Recharts view with separate historical and dashed
baseline series, date filters, accessible chart labeling, empty/insufficient/error
states, and source/freshness/method text. The server-backed conversation list uses
the existing owner-scoped conversation endpoints; the client does not label
component-only state as saved history. Existing application shell embeds the same
role-capability assistant in role contexts; no new role-specific permission was
introduced.

### Changes and verification

- `clinic/frontend/src/features/ai/ai-assistant-page.tsx`: reorganized the
  workspace into an operational-data section, a larger assistant area, and
  evidence/freshness plus human-review panels.
- `clinic/frontend/src/features/ai/ai-assistant-panel.tsx`: corrected the
  generated-forecast label, described the fact card as a snapshot, surfaced the
  time-series limitation, and added retry controls for capability and forecast
  loading errors.
- `clinic/frontend/src/services/api/ai.ts`: added the typed historical-series
  response and date-range API client.
- `clinic/backend/src/main/java/com/clinic/repository/AppointmentRepository.java`:
  added a daily, non-identifying grouped-count query with optional principal scope.
- `clinic/backend/src/main/java/com/clinic/ai/AiCapabilityService.java` and
  `AiService.java`: added permission-checked bounded series calculation and
  deterministic baseline.
- `clinic/backend/src/main/java/com/clinic/controller/AiController.java` and
  `dto/response/AiHistoricalForecastResponse.java`: exposed the typed endpoint.
- `clinic/backend/src/test/java/com/clinic/security/AiAuthorizationTest.java`:
  added future-date, insufficient-history, and patient-history isolation tests.
- `clinic/frontend`: `npm run typecheck` passed (exit 0).
- `clinic/frontend`: `npm run lint` passed (exit 0, 0 errors, 160 warnings).
- `clinic/frontend`: targeted `npx eslint src/features/ai/ai-assistant-panel.tsx src/features/ai/ai-assistant-page.tsx src/services/api/ai.ts` passed (0 warnings/errors).
- `clinic/frontend`: `npm run build` passed (exit 0; optimized production build,
  101 static pages).
- `clinic/backend`: `mvn -f clinic/backend/pom.xml -Dtest=AiAuthorizationTest test`
  passed (exit 0; 22 tests, 0 failures, 0 errors, 0 skipped).
- `git diff --check` passed.
- Full backend regression/package, AI provider tests, API E2E, Playwright suites,
  and live external provider/email integrations were not rerun in this follow-up.

The StockFlow reference repository was specified by URL but was not available in
the local checkout for direct file inspection; network access was unavailable.
No reference files were copied. Remaining work includes full chat transcript
source metadata on historical turns, a broader UI test suite for the new chart
and conversation selector, and the previously recorded deployment/provider,
email, database concurrency, and credential-gated E2E validation.

## CliniCel Docker and runtime follow-up (2026-10-25)

**Status: PARTIALLY IMPLEMENTED.** The confirmed `ERR_EMPTY_RESPONSE` cause in the
Compose stack was a port mismatch: the backend Docker image defaulted to port
10000, while Compose mappings, backend health checks, and the production Nginx
upstream all targeted port 8080. Compose now explicitly sets the backend to 8080.
Health checks use Spring Boot readiness so they wait for startup initialization.
The production profile requires its database password and JWT secret instead of
falling back to development defaults. The production frontend API base path is
compiled as same-origin `/api/v1`, matching the Nginx proxy. The local runbook
now documents the port and URL setup.

Next.js `allowedDevOrigins` includes the observed browser development host
addresses, addressing the reported HMR origin. No application-owned WebSocket
endpoint was identified as the source of the browser's webpack HMR socket.

Validation this follow-up:

- `docker compose -f docker-compose.yml config --quiet`: passed with temporary
  non-secret validation environment variables.
- `docker compose -f docker-compose.prod.yml config --quiet`: passed with
  temporary non-secret validation environment variables.
- Python YAML parse for both Compose files: passed.
- `node --check frontend/next.config.mjs`: passed.
- Docker engine could not be reached in this Windows session, so containers were
  not started. PostgreSQL on localhost:5432 did not respond. Consequently no
  live database history or existing appointment overlap rows were inspected.
- The existing modified `scripts/verify-migrations.ps1` ends in a malformed
  assignment (`$env:SPRING_DATASOURCE_PASSWORD = ""=`). This working-tree edit
  was preserved; its migration verification cannot be trusted or run until
  repaired. No migration or database data was modified.

The existing report above contains earlier frontend, backend, AI authorization,
forecast, and API/E2E evidence. Those tests were not rerun in this infra
follow-up. Production data migration state, the full browser suite with staging
credentials, Docker-enabled concurrency checks, and real provider/email
integrations remain unverified.

## Final implementation and verification follow-up (2026-10-25)

**Status: PARTIALLY IMPLEMENTED.** This section supersedes outdated blocker
statements above where later verification succeeded. The generic development
configuration no longer contains a default JWT signing key or datasource
password; local ignored environment configuration supplies these values, tests
use their test profile, and production requires explicit values.

Verification completed:

- `mvn -o clean test`: passed, 323 tests.
- PostgreSQL concurrency test with Testcontainers: passed; one reservation wins
  for a conflicting doctor/date insert.
- Fresh disposable PostgreSQL migration run: V1–V28 applied and Hibernate
  schema validation passed. No production database history or data was altered.
- Existing backend API workflow against isolated H2: all 18 sections passed.
- Frontend `npm run typecheck` and `npm run lint`: passed (lint reports 160
  warnings and no errors).
- Frontend optimized production build: passed with the Windows sandbox's needed
  elevated filesystem access.
- Browser suite: the initial complete 43-test run passed 36 tests; all seven
  setup-dependent failures passed in a subsequent 17-test run after seeding the
  isolated backend. A single complete rerun after seeding was not performed.
- AI appointment proposal browser tests: 6 passed.
- Compose configuration, migration script syntax, and `git diff --check`:
  passed.

Remaining verification requires external state: inspect the production
`flyway_schema_history` and existing appointment rows before any data-changing
migration; verify hosted AI and SMTP credentials/quotas; and perform the full
browser suite in one run after seeded test setup. The StockFlow reference
repository was not available for direct inspection, so no claim of pixel-level
matching or copied reference implementation is made.
