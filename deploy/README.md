# CarOps – sicherer Produktionsbetrieb

Diese Anleitung beschreibt den Compose-Betrieb für `https://carops.de`. Änderungen
zuerst in Staging prüfen. Die Anwendung wird hinter einem TLS-Reverse-Proxy
betrieben; PostgreSQL und Backend veröffentlichen keine Host-Ports.

## 1. Server und SSH vorbereiten

- Einen dedizierten, nicht als `root` arbeitenden Deploy-Benutzer verwenden.
- Root-Login und Passwort-Login in SSH deaktivieren, Schlüssel-Login erzwingen und
  SSH-Zugriff per Firewall auf bekannte Admin-Netze begrenzen.
- Docker-Zugriff ist praktisch Root-Zugriff. Mitgliedschaft in der `docker`-Gruppe
  nur dem dedizierten Deploy-Benutzer geben und dessen SSH-Schlüssel besonders
  schützen.
- Repository beispielsweise unter `/opt/mainauto` ablegen. Keine Produktionsdaten
  oder `.env`-Dateien in Git aufnehmen.

Einmalige Verzeichnisvorbereitung mit administrativen Rechten:

```bash
cd /opt/mainauto
install -d -m 0700 -o 70 -g 70 data/postgres
install -d -m 0700 -o 1001 -g 1001 data/uploads
install -d -m 0700 -o deploy -g deploy backups
cp deploy/.env.compose.example .env
chown deploy:deploy .env
chmod 0600 .env
```

`70:70` ist der Benutzer des gepinnten PostgreSQL-Alpine-Images.
`APP_UID=1001` und `APP_GID=1001` entsprechen dem bestehenden Upload-Verzeichnis.
Bei einer anderen Host-UID müssen `.env`, Eigentümer und Compose-Werte gemeinsam
angepasst werden.

## 2. Secrets und Domains konfigurieren

In `.env` mindestens alle `replace-me`-Werte ersetzen. Sichere Zufallswerte können
beispielsweise mit `openssl rand -base64 48` erzeugt werden.

Wesentliche Produktionswerte:

```dotenv
WEB_BIND_ADDRESS=0.0.0.0
WEB_PORT=8080
APP_UID=1001
APP_GID=1001
BACKEND_URL=https://carops.de
PUBLIC_APP_URL=https://carops.de
PLATFORM_DOMAIN=carops.de
PLATFORM_SUPPORT_EMAIL=support@carops.de
CORS_ALLOWED_ORIGINS=https://carops.de
AUTH_DISABLE_CSRF_CHECK=false
BOOTSTRAP_ADMIN=false
```

`POSTGRES_PASSWORD`, `DATABASE_URL` und `BETTER_AUTH_SECRET` haben in Compose
keine funktionsfähigen Defaultwerte; ein Start ohne diese Werte schlägt fehl.
`COOKIE_DOMAIN` sollte leer bleiben, solange kein bewusstes
Cross-Subdomain-Setup benötigt wird.

## 3. Netzwerk und Reverse Proxy

Der bestehende Nginx Proxy Manager erreicht `192.168.178.66:8080`. Deshalb bindet
Compose kompatibel standardmäßig an `0.0.0.0:8080`. Der Port darf weder am Router
ins Internet weitergeleitet noch allgemein im Server-Firewallprofil freigegeben
werden: Erlaubt wird ausschließlich die IP beziehungsweise das Docker-Netz des
Reverse Proxys.

Wenn der TLS-Proxy direkt auf demselben Host läuft und Loopback erreichen kann,
ist die strengere Einstellung vorzuziehen:

```dotenv
WEB_BIND_ADDRESS=127.0.0.1
```

Der TLS-Proxy muss `Host`, `X-Forwarded-For` und `X-Forwarded-Proto` korrekt setzen.
Nur `carops.de` auf Port 8080 routen. TLS 1.2/1.3 aktivieren, HTTP dauerhaft auf
HTTPS umleiten und Zertifikatserneuerung überwachen.

`deploy/nginx.conf` vertraut Client-IP-Header ausschließlich dem aktuell
ermittelten Nginx-Proxy-Manager-Netz `172.19.0.0/16`. Nach einer Änderung am
Docker-Netz muss `set_real_ip_from` vor dem Rollout angepasst werden. Direkte
Zugriffe auf Port 8080 müssen zusätzlich per Firewall ausgeschlossen bleiben;
sonst könnten Angreifer Client-IP-Header fälschen und Rate-Limits umgehen.

## 4. Preflight und Start

Vor jedem Deployment:

```bash
./deploy/hardening-check.sh .env
test "$(stat -c '%u:%g' data/uploads)" = "$(awk -F= '/^APP_UID=/{u=$2} /^APP_GID=/{g=$2} END{print u \":\" g}' .env)"
docker compose --env-file .env -p carops-prod config --quiet
```

Danach bauen und starten:

```bash
docker compose --env-file .env -p carops-prod up -d --build
docker compose --env-file .env -p carops-prod ps
curl -fsS http://127.0.0.1:8080/health
curl -fsS https://carops.de/health
```

Backend und Web laufen ohne Root-Rechte. Ihre Root-Dateisysteme sind read-only;
nur Upload-Volume und begrenzte `tmpfs`-Verzeichnisse sind beschreibbar. Sämtliche
Linux-Capabilities sind entfernt und `no-new-privileges` ist aktiv. Da die
Anwendung Chromium derzeit weiterhin mit `--no-sandbox` startet, sind diese
Containergrenzen sicherheitsrelevant und dürfen nicht entfernt werden.

### Einmaliger erster Admin

`BOOTSTRAP_ADMIN=true` sowie ein langes Einmalpasswort nur für den ersten Start
setzen. Nach erfolgreicher Anmeldung sofort:

1. `BOOTSTRAP_ADMIN=false` setzen.
2. `INITIAL_ADMIN_PASSWORD` und sonstige Bootstrap-Werte leeren.
3. Backend mit
   `docker compose --env-file .env -p carops-prod up -d --force-recreate backend`
   neu erstellen.

## 5. Staging

Staging verwendet eigene Daten, Secrets, Ports und eine eigene Domain:

```bash
cp deploy/.env.staging.example .env.staging
chmod 0600 .env.staging
install -d -m 0700 data-staging/postgres data-staging/uploads backups-staging
docker compose --env-file .env.staging -p carops-staging up -d --build
```

Vorher die Eigentümer analog zur Produktion auf PostgreSQL- beziehungsweise
`APP_UID:APP_GID` setzen. Staging darf niemals Produktionsdaten oder
Produktions-Secrets verwenden.

## 6. Verschlüsselte Backups

Das Skript schreibt atomar, verwendet `umask 077`, setzt Dateien auf Modus `0600`,
erstellt SHA-256-Manifeste und entfernt nur abgeschlossene Dateien mit passendem
Prefix nach Ablauf der Retention.

Empfohlen mit `age`:

```bash
COMPOSE_ENV_FILE=.env \
COMPOSE_PROJECT_NAME=carops-prod \
BACKUP_DIR=/opt/mainauto/backups \
BACKUP_PREFIX=carops \
RETENTION_DAYS=14 \
BACKUP_ENCRYPTION=age \
AGE_RECIPIENT='age1...' \
./deploy/backup.sh
```

Alternativ:

- `BACKUP_ENCRYPTION=gpg` und `GPG_RECIPIENT=...`
- `BACKUP_ENCRYPTION=none` nur auf bereits verschlüsseltem Storage
- `BACKUP_OFFSITE_HOOK=/absoluter/pfad/upload-backup` für ein ausführbares
  Offsite-Skript. Es erhält Datenbank, Upload-Archiv und Manifest als Argumente
  und muss Uploadfehler mit einem Exit-Code ungleich null melden.

Ein täglicher systemd-Timer ist Cron vorzuziehen. Das Backup-Log ebenfalls über
Journald oder `logrotate` begrenzen. Für eine klassische Logdatei:

```text
/var/log/carops-backup.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  create 0600 deploy deploy
}
```

Mindestens eine verschlüsselte, immutable Offsite-Kopie in einem getrennten Konto
aufbewahren. Zugriff und fehlgeschlagene Backup-Läufe alarmieren.

## 7. Backup prüfen und Restore proben

Nach jedem Backup Checksummen und Archivstruktur prüfen:

```bash
AGE_IDENTITY_FILE=/sicherer/pfad/carops.agekey \
./deploy/restore-check.sh \
  backups/carops_db_YYYYMMDDTHHMMSSZ.dump.age \
  backups/carops_uploads_YYYYMMDDTHHMMSSZ.tar.gz.age \
  backups/carops_manifest_YYYYMMDDTHHMMSSZ.sha256
```

Der Strukturcheck ersetzt keinen echten Restore. Monatlich in einen isolierten,
nicht öffentlich erreichbaren Staging-Stack zurückspielen und Login,
Fahrzeugbilder sowie PDF-Erzeugung prüfen.

Für einen geplanten Produktions-Restore:

1. Wartungsfenster aktivieren und aktuellen Backup-Snapshot erstellen.
2. Anwendungen stoppen, aber PostgreSQL laufen lassen.
3. Backup entschlüsseln und Manifest prüfen.
4. Datenbank mit `pg_restore --clean --if-exists --no-owner --no-privileges`
   wiederherstellen.
5. Das Upload-Verzeichnis zuerst in ein datiertes, nur lesbares
   Rollback-Verzeichnis verschieben und danach das Archiv in ein neues
   `data/uploads` entpacken.
6. Eigentümer `APP_UID:APP_GID` und Modus `0700` setzen, Stack starten und
   fachliche Smoke-Tests durchführen.

Die genauen Restore-Kommandos immer zuerst mit denselben Image-Versionen in
Staging validieren. Ein Restore ist destruktiv und darf nicht ungeprüft gegen die
Produktionsdatenbank laufen.

## 8. Rotation und Incident-Betrieb

- `BETTER_AUTH_SECRET`: Rotation invalidiert Sitzungen; Wartungsfenster und
  erneute Anmeldung ankündigen.
- PostgreSQL-Passwort: Datenbankrolle und `DATABASE_URL` koordiniert ändern.
- OpenAI-/Stripe-Schlüssel: Beim Anbieter rotieren, `.env` aktualisieren,
  Backend neu erstellen und alte Schlüssel widerrufen.
- SSH-/Backup-Schlüssel: mindestens jährlich sowie sofort nach Personalwechsel
  oder Verdacht rotieren.
- Stripe-Webhook-Secret nach Rotation im Stripe-Dashboard und in `.env`
  synchronisieren.

Produktionszugriffe, fehlgeschlagene Logins, Admin-Aktionen, Backupstatus,
Speicherplatz, Container-Restarts und Zertifikatsablauf zentral überwachen.
Docker-Logs sind auf fünf Dateien à 10 MiB begrenzt.

## 9. Update- und Cutover-Checkliste

1. Verschlüsseltes Backup plus erfolgreichen `restore-check` bestätigen.
2. Neue Images in Staging mit `--build` bauen.
3. Login, Kunden, Fahrzeuge, An-/Verkauf, Rechnungen, Verträge, Uploads und PDFs
   testen.
4. Dependency- und Container-Scans ausführen; Patchupdates getrennt von
   Funktionsänderungen deployen.
5. Produktion aktualisieren und `/health` intern wie extern prüfen.
6. Logs und Restart-Zähler mindestens 30 Minuten beobachten.
7. `BOOTSTRAP_ADMIN=false`, `AUTH_DISABLE_CSRF_CHECK=false`, Dateirechte,
   Firewall und Offsite-Backup erneut bestätigen.
