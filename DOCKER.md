# Docker Deployment

## 1) Prepare env

Copy env template:

```bash
cp .env.docker.example .env
```

Set at minimum:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `NEXT_PUBLIC_API_URL` (public backend URL)
- `CORS_ORIGIN` (public frontend URL)

## 2) Build and run

```bash
docker compose up --build -d
```

Services:

- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000`
- Postgres: `localhost:5433`

## 3) Logs

```bash
docker compose logs -f server
docker compose logs -f client
```

## Notes

- Backend container runs `prisma migrate deploy` on startup.
- Uploaded files are persisted in Docker volume `uploads_data`.
- DB data is persisted in Docker volume `postgres_data`.
- For production, put frontend/backend behind a reverse proxy (Nginx/Traefik/Caddy) with HTTPS.

## Production: Reverse Proxy + HTTPS

This repo includes:

- `docker-compose.prod.yml`
- `infra/caddy/Caddyfile`

Run production stack with Caddy (automatic Let's Encrypt):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Required `.env` values for production:

- `APP_DOMAIN` (example: `app.example.com`)
- `API_DOMAIN` (example: `api.example.com`)
- `LETSENCRYPT_EMAIL`
- `JWT_SECRET`
- `POSTGRES_*`

DNS:

- `APP_DOMAIN` -> server public IP
- `API_DOMAIN` -> server public IP

## CI/CD

Workflow: `.github/workflows/ci-cd.yml`

On pull requests:

- builds client + server

On push to `main`:

- builds and pushes Docker images to GHCR
- optional SSH deploy (if secrets are configured)

Secrets for deploy job:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `DEPLOY_PATH`
- `GHCR_USER`
- `GHCR_TOKEN`
- optional `NEXT_PUBLIC_API_URL`
