# CI/CD

GitHub Actions is configured in `.github/workflows/ci-cd.yml`.

## What Runs

- Pull requests and pushes to `main`, `master`, and `develop` run backend tests and frontend builds.
- Backend CI uses Java 21 and runs `mvn -B "-Dspring.profiles.active=test" test`, then packages the JAR.
- Frontend CI uses Node 20, runs `npm ci`, `npx tsc --noEmit`, and `npm run build`.
- Pushes to `main` or `master`, and manual workflow runs, build and publish backend/frontend Docker images to GHCR.
- Pushes to `main` can deploy over SSH when deployment secrets are configured.

## Published Images

Images are published as:

- `ghcr.io/<owner>/<repo>-backend:latest`
- `ghcr.io/<owner>/<repo>-frontend:latest`
- matching immutable tags using the Git commit SHA

## Required Repository Secrets For SSH Deploy

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`

Optional:

- `DEPLOY_PORT`, defaults to `22`
- `DEPLOY_PATH`, defaults to `/opt/clinic` in the deploy script

## Server Setup

Place `clinic/docker-compose.prod.yml`, `negixs/nginx.conf`, and a `.env` file under the deployment directory. The `.env` file should set:

```env
BACKEND_IMAGE=ghcr.io/<owner>/<repo>-backend:latest
FRONTEND_IMAGE=ghcr.io/<owner>/<repo>-frontend:latest
POSTGRES_PASSWORD=change-me
APP_JWT_SECRET=base64-encoded-secret
NEXT_PUBLIC_API_BASE_URL=http://your-domain/api/v1
NEXT_PUBLIC_APP_URL=http://your-domain
CORS_ALLOWED_ORIGINS=http://your-domain
```

If GHCR packages are private, log in on the server with a token that can read packages before the first deployment:

```bash
docker login ghcr.io
```
