# MainAuto Production Deployment

## 1) Prepare server
1. Copy this project to your server.
2. Copy `deploy/.env.compose.example` to `.env` in project root and set real secrets.
3. Replace placeholder values (`POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `INITIAL_ADMIN_PASSWORD`) before first start.
4. Make sure Cloudflare + Nginx Proxy Manager route `mainauto.rabauke.uk` to host port `8080`.

## 2) First start
Create persistent host folders first:
```bash
mkdir -p data/postgres data/uploads backups
```

Then start containers:
```bash
docker compose up -d --build
```

If you want to bootstrap the first admin once:
1. Set `BOOTSTRAP_ADMIN=true` and `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` in `.env`.
2. Start containers.
3. After first successful login, set `BOOTSTRAP_ADMIN=false` again and restart backend:
```bash
docker compose up -d backend
```

## 3) Health checks
```bash
curl -sSf http://127.0.0.1:8080/ >/dev/null
curl -sSf http://127.0.0.1:8080/health
```

## 4) Daily backups (14-day retention)
Run daily at 02:30 via cron:
```bash
30 2 * * * cd /path/to/mainauto_management_app && ./deploy/backup.sh >> /var/log/mainauto-backup.log 2>&1
```

Backups are written to `./backups` by default.

## 5) Restore
### Restore database
```bash
cat backups/mainauto_db_YYYYMMDD_HHMMSS.sql | docker compose exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

### Restore uploads
```bash
docker compose exec -T backend sh -lc 'rm -rf /app/uploads/*'
cat backups/mainauto_uploads_YYYYMMDD_HHMMSS.tar.gz | docker compose exec -T backend sh -lc 'tar -xzf - -C /app/uploads'
```

## 6) Cutover checklist
1. Rotate `BETTER_AUTH_SECRET` and DB password before go-live.
2. Ensure no real credentials are committed in repo `.env` files.
3. Confirm `BOOTSTRAP_ADMIN=false` after initial admin is created.
4. Verify login, vehicle CRUD, upload, and document PDF generation.
5. Run one backup and one restore test before productive usage.
