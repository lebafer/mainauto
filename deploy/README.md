# MainAuto Production Deployment

## 1) Prepare server
1. Copy this project to your server.
2. Copy `deploy/.env.compose.example` to `.env` in project root and set real secrets.
3. (Optional but recommended) Copy `deploy/.env.staging.example` to `.env.staging` for a separate staging stack.
4. Replace placeholder values (`POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `INITIAL_ADMIN_PASSWORD`) before first start.
5. Keep `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` for reliable PDF generation in Docker.
6. Make sure Cloudflare + Nginx Proxy Manager route `mainauto.rabauke.uk` to host port `8080`.

## 2) First start
Create persistent host folders first:
```bash
mkdir -p data/postgres data/uploads backups
```

Then start containers:
```bash
docker compose --env-file .env -p mainauto-prod up -d --build
```

If you want to bootstrap the first admin once:
1. Set `BOOTSTRAP_ADMIN=true` and `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` in `.env`.
2. Start containers.
3. After first successful login, set `BOOTSTRAP_ADMIN=false` again and restart backend:
```bash
docker compose --env-file .env -p mainauto-prod up -d backend
```

## 3) Health checks
```bash
curl -sSf http://127.0.0.1:8080/ >/dev/null
curl -sSf http://127.0.0.1:8080/health
```

## 4) Staging environment
Create isolated staging folders:
```bash
mkdir -p data-staging/postgres data-staging/uploads backups-staging
```

Start staging stack:
```bash
docker compose --env-file .env.staging -p mainauto-staging up -d --build
```

Typical staging checks:
```bash
curl -sSf http://127.0.0.1:8081/ >/dev/null
curl -sSf http://127.0.0.1:8081/health
```

Route `staging-mainauto.rabauke.uk` in Nginx Proxy Manager to host port `8081`.

## 5) Deploy workflow (staging -> live)
1. Deploy feature branch to staging:
```bash
git fetch origin
git checkout <feature-branch>
docker compose --env-file .env.staging -p mainauto-staging up -d --build
```
2. Test in staging.
3. Merge to `main`.
4. Deploy `main` to production:
```bash
git checkout main
git pull
docker compose --env-file .env -p mainauto-prod up -d --build
```

## 6) Daily backups (14-day retention)
Production cron (02:30):
```bash
30 2 * * * cd /path/to/mainauto_management_app && COMPOSE_ENV_FILE=.env COMPOSE_PROJECT_NAME=mainauto-prod BACKUP_DIR=./backups BACKUP_PREFIX=mainauto ./deploy/backup.sh >> /var/log/mainauto-backup.log 2>&1
```

Staging cron (03:00):
```bash
0 3 * * * cd /path/to/mainauto_management_app && COMPOSE_ENV_FILE=.env.staging COMPOSE_PROJECT_NAME=mainauto-staging BACKUP_DIR=./backups-staging BACKUP_PREFIX=mainauto_staging ./deploy/backup.sh >> /var/log/mainauto-staging-backup.log 2>&1
```

Backups are written to `BACKUP_DIR` (default `./backups`).

## 7) Restore
### Restore database
```bash
cat backups/mainauto_db_YYYYMMDD_HHMMSS.sql | docker compose --env-file .env -p mainauto-prod exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

### Restore uploads
```bash
docker compose --env-file .env -p mainauto-prod exec -T backend sh -lc 'rm -rf /app/uploads/*'
cat backups/mainauto_uploads_YYYYMMDD_HHMMSS.tar.gz | docker compose --env-file .env -p mainauto-prod exec -T backend sh -lc 'tar -xzf - -C /app/uploads'
```

## 8) Cutover checklist
1. Rotate `BETTER_AUTH_SECRET` and DB password before go-live.
2. Ensure no real credentials are committed in repo `.env` files.
3. Confirm `BOOTSTRAP_ADMIN=false` after initial admin is created.
4. Verify login, vehicle CRUD, upload, and document PDF generation.
5. Run one backup and one restore test before productive usage.

## 9) PDF troubleshooting
If document generation returns HTTP 500:
```bash
docker compose --env-file .env -p mainauto-prod logs backend --tail=200 | grep -i documents
```
You should see one of these startup hints in logs:
- `using_browser_executable=...`
- `using_system_browser=...`
- `using_sparticuz_browser=...`
