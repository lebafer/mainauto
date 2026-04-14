# CI/CD Zielbild

## Kurzfristig
- Arbeiten nur auf Feature-Branches
- GitHub Actions validiert jeden Branch
- Feature-Branches koennen auf Stage deployed werden
- Review erfolgt ueber Pull Request
- `main` bleibt produktionsnah und wird nur nach Freigabe deployed

## Staging-Flow
1. Push auf `feature/*`, `develop` oder `staging`
2. GitHub Actions fuehrt aus:
   - `bun install`
   - Backend Typecheck
   - Webapp Build
3. Wenn erfolgreich, Deployment auf Staging per SSH
4. Healthcheck der Container nach Deploy

## Produktions-Flow
1. Pull Request wird reviewed
2. Nur nach expliziter Freigabe Merge auf `main`
3. Separater Produktions-Workflow deployed `main`
4. Danach Smoke-Checks und optional Rollback-Plan

## Noch offen
- eigene Workflow-Datei fuer Produktion
- optional Lint + Tests erweitern
- Healthchecks robuster machen
- Rollback-Skript bauen
- Branch-basiertes Stage-Preview-Konzept definieren

## GitHub Secrets
Fuer den Staging-Workflow werden benoetigt:
- `STAGING_HOST`
- `STAGING_USER`
- `STAGING_SSH_KEY`

Optional spaeter fuer Produktion:
- `PROD_HOST`
- `PROD_USER`
- `PROD_SSH_KEY`
