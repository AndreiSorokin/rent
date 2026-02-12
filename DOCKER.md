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
