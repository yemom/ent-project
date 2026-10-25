# Deploy runbook

Everything needed to verify and release this application. ASCII only, because
PowerShell 5.1 reads `.ps1` files as ANSI unless they carry a BOM, and a smart quote
in a comment silently breaks parsing.

---

## 1. One command

```powershell
./scripts/verify-all.ps1
```

Runs, in order, and stops reporting on the first stage that fails:

| Stage | What it proves |
|---|---|
| preflight | No stale dev server, build or backend that would corrupt later results |
| `mvn -o clean test` | Backend compiles and all unit/integration tests pass |
| `mvn -o clean package` | A deployable jar is produced |
| `./e2e-start-and-run.ps1` | The API suite passes against a freshly booted backend |
| `npx tsc --noEmit` | Frontend types are sound |
| `npm run build` | Frontend production build succeeds |
| `npx playwright test` | The browser suite passes against the real app |

Use `-SkipE2E` for the compile-and-unit stages only.

### Never run two builds at once

Two concurrent Maven runs write to the same `target/classes` and produce errors that
do not exist in the source (`cannot find symbol` on a file that compiles fine), and
two Next.js processes sharing `.next` fail with
`ENOENT: .next/server/pages-manifest.json`. Both look like real bugs and cost a full
investigation cycle. `preflight.ps1` exists to stop this happening by accident.

---

## 2. Migrations

```powershell
./scripts/verify-migrations.ps1
```

**Run this before every deploy that includes a migration.** It starts a throwaway
PostgreSQL cluster, runs the whole Flyway chain against it, and then boots the
application with `ddl-auto=validate`.

This check is not optional, and the reason is specific: the regular test suite runs
on H2 with Flyway disabled, because the migrations contain PostgreSQL triggers and
`DO` blocks that H2 cannot execute. That is a deliberate trade-off with a sharp
edge — **a migration can be completely broken against PostgreSQL and every local
check still passes.** That is not hypothetical: V16 indexed `audit_logs(actor_id)`,
a column that does not exist, and only the first production deploy found it.

The script needs a local PostgreSQL (`initdb` on `PATH`, or under
`C:\Program Files\PostgreSQL\<major>\bin`). Pass `-UseRunningInstance` to target a
server that is already up.

---

## 3. Local Docker stack

From the `clinic` directory, load the ignored local backend environment file for
Compose run:

```powershell
docker compose up --build
```

The ignored `backend/.env.local` file is loaded into the PostgreSQL and backend
containers. It must define `SPRING_DATASOURCE_PASSWORD` and `APP_JWT_SECRET`.
PostgreSQL and Spring Boot use the same database password. Create it from
`backend/.env.example` if it is missing, then replace the example credentials
before starting the stack.

The backend listens on port 8080 inside Compose; the dev stack publishes it at
`localhost:8090`. The frontend is available at `http://localhost:3000`; its
browser API URL defaults to `http://localhost:8090/api/v1`. For access from
another device on the same LAN, set `LAN_HOST` in PowerShell to the Docker
host's LAN IP before building, and open the frontend at that IP on port 3000.
For example: `$env:LAN_HOST="192.168.1.20"; docker compose up --build`. Keep
credentials in an ignored local env file or your environment
and never commit them. The production frontend uses the
same-origin `/api/v1` path, routed by Nginx, which is compiled into the image.
Stop the stack with `docker compose down`; do not add `-v` if you need to retain
the database volume.

## 4. Required production environment

| Variable | Required | Notes |
|---|---|---|
| `SPRING_DATASOURCE_URL` | yes | JDBC URL |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | yes | |
| `APP_JWT_SECRET` | yes | Base64, **at least 64 bytes**. HS512 rejects anything shorter and startup fails rather than 500-ing every login |
| `SUPER_ADMIN_NAME` / `_EMAIL` / `_PASSWORD` | yes | See below |
| `CORS_ALLOWED_ORIGINS` | yes | Comma-separated, exact origins |
| `MAIL_HOST` / `MAIL_PORT` | only if password reset is enabled | Use the SMTP provider's submission endpoint and port; do not use an inbound MX host |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | only if required by the provider | Keep both server-side in Render secret environment variables |
| `MAIL_FROM` | only if password reset is enabled | Must be an address/domain permitted by the provider |
| `MAIL_START_TLS` | only if password reset is enabled | `true` for STARTTLS submission; set only according to the provider's documented transport |
| `MAIL_SSL_ENABLE` | only if password reset is enabled | `true` only for an implicit-TLS SMTP endpoint; do not enable both modes unless the provider explicitly requires it |
| `MAIL_CONNECTION_TIMEOUT_SECONDS` / `MAIL_TIMEOUT_SECONDS` / `MAIL_WRITE_TIMEOUT_SECONDS` | no | Defaults to 10 seconds each; keep finite |
| `PORT` | Render-provided | The application binds to `0.0.0.0` through Render's port-aware server configuration; local/container default is `10000` |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | no | Defaults to `validate`. Never `update` in production: it would silently patch the schema and hide a bad migration |

The application does not connect to SMTP during startup or health checks. It opens
SMTP only while handling a password-reset request. A failed delivery returns
`503 Service Unavailable`, records a sanitized audit event, and never logs the
message body or reset token. `/api/v1/health` is intentionally independent of
SMTP, the database, and Redis.

### Super Admin bootstrap

Without `SUPER_ADMIN_PASSWORD` the initializer generates a random password and logs
that it did — producing a deployment nobody can sign into, and because a container is
restarted from scratch there is no second chance to read it from a log. In
`docker-compose.prod.yml` all three are marked `:?set ...`, so a misconfigured stack
refuses to start rather than coming up unusable.

The initializer will not overwrite the password of an account that is already a
Super Admin. To force a reset, set `SUPER_ADMIN_FORCE_PASSWORD=true`.

---

## 5. Recovering from a failed migration

Flyway records a failed migration in `flyway_schema_history` and then refuses every
later run, so **one failed deploy bricks the next deploy too.**

This project sets `spring.flyway.repair-on-startup: true` in the prod profile, and
`FlywayConfig` runs `flyway.repair()` before `flyway.migrate()`. Repair removes only
the failure markers; it never rolls anything back. So in practice the next deploy
retries cleanly on its own.

If the retry needs a hand:

```sql
-- Confirm the failure marker.
SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;

-- PostgreSQL DDL is transactional, so a failed migration left nothing behind.
-- Confirm that before deleting the marker.
SELECT * FROM audit_logs LIMIT 1;
```

Then clear the marker and redeploy:

```sql
DELETE FROM flyway_schema_history WHERE success = false;
```

**Only ever delete rows with `success = false`.** Deleting a successful row makes
Flyway re-run that migration against a database that already has it.

---

## 6. Release checklist

- [ ] `./scripts/verify-all.ps1` green
- [ ] `./scripts/verify-migrations.ps1` green, if any migration changed
- [ ] No migration file that has already been applied has been **edited** — corrections go in a new, higher-numbered file. Editing an applied migration breaks its checksum and fails the deploy.
- [ ] No credentials committed. `backend/.env.local` and `backend/e2e-secret.txt` are git-ignored and must stay that way
- [ ] Production environment variables set, including all three `SUPER_ADMIN_*`
- [ ] `CORS_ALLOWED_ORIGINS` contains the real frontend origin

---

## 7. If something fails

| Symptom | Cause |
|---|---|
| `ENOENT: .next/server/pages-manifest.json` | Two Next.js processes sharing `.next`. Kill them, or run preflight |
| `cannot find symbol` on a file that compiles | Two Maven runs sharing `target/classes`. `mvn clean` and run one at a time |
| Flyway `Validate failed: checksum mismatch` | An already-applied migration was edited. Restore it and add a new migration |
| Flyway `Detected failed migration` | See section 4 |
| `connection to server ... failed` in `verify-migrations.ps1` | Port 55432 already taken. Stop the other cluster, or pass `-UseRunningInstance` |
| Login succeeds then bounces to `/login` on reload | Session restore regression. `auth-store` derives `isAuthenticated` on rehydration; the route guard reads the token and profile, never that flag |
