# Operator Runbook — Pilot Sales Distribution

This runbook is for the **on-call operator / DevOps engineer** who keeps
the site live. It is intentionally procedural: each task has a command
and an expected output. If a command fails, **stop and follow the
"Failure modes" link at the bottom of the section** before improvising.

The runbook covers:

1. Environments and where the data lives
2. Daily checks
3. Deployment (frontend + inventory API)
4. Rollback (both services)
5. Database backups
6. Monitoring & alerting
7. Incident response (severity ladder)
8. Common failure modes and their fixes

---

## 1. Environments

| Env | Storefront | Inventory API | Database | Notes |
|---|---|---|---|---|
| **local** | `localhost:8080` (preview.py) | `localhost:8080/api/...` | none (in-memory snapshot) | uses the demo fixture in `services/pse-inventory/fixtures/` |
| **staging** | `https://staging.pilotsalesdistribution.com` (Vercel preview) | staging container | staging Postgres | safe to break |
| **production** | `https://pilotsalesdistribution.com` (Vercel) | `https://inventory.pilotsalesdistribution.com` | managed Postgres + Valkey | do not improvise |

The **staging** and **production** URLs, project IDs, and database
connection strings are stored in the operator's password manager under
the entry `pse-distribution`. They are **never** in the repository
or in `.env.example`.

---

## 2. Daily checks (5 min)

```bash
# Health — all three must be 200 OK
curl -fsS https://pilotsalesdistribution.com/internal/healthz      || alert
curl -fsS https://inventory.pilotsalesdistribution.com/internal/healthz  || alert
curl -fsS https://inventory.pilotsalesdistribution.com/internal/readyz   || alert

# Snapshot age — must be < PSE_MAX_LAST_GOOD_AGE_SECONDS (default 300s)
curl -fsS https://inventory.pilotsalesdistribution.com/api/inventory?limit=1 | jq '.snapshot.generated_at, .snapshot.records'

# Error rate — alert if > 1% in last hour
# (see Prometheus / Grafana dashboard "PSE — Errors")

# Database & cache size — alert if Postgres > 80% capacity or Valkey > 256MB
psql "$PSE_DATABASE_URL" -c "SELECT pg_database_size(current_database());"
redis-cli -u "$PSE_VALKEY_URL" INFO memory | grep used_memory_human
```

If any of these fail, go straight to section 7 (Incident response).

---

## 3. Deployment

### Frontend (storefront)

The storefront is a static site on Vercel. Every merge to `main`
auto-deploys. To deploy a hotfix:

```bash
# 1. Branch from main
git checkout main && git pull
git checkout -b hotfix/short-description

# 2. Commit the fix, push, open a PR
git commit -am "fix: <what>"
git push origin hotfix/short-description
gh pr create --base main --title "hotfix: <what>"

# 3. After review + merge, Vercel builds in ~60s. Watch:
gh pr checks --watch   # or: open the Vercel dashboard

# 4. Verify in production
curl -fsS https://pilotsalesdistribution.com/ | head -20
```

### Inventory API

The API deploys via the `Deploy` GitHub Actions workflow on a
`vX.Y.Z` tag push. Full process:

```bash
# 1. Make sure tests are green on main
gh workflow run ci --ref main

# 2. Bump version in services/pse-inventory/pyproject.toml + lock files
./scripts/bump-inventory-version.sh 4.1.0   # helper, see scripts/

# 3. Tag and push
git tag v4.1.0
git push origin v4.1.0

# 4. Watch the workflow
gh run watch --workflow deploy

# 5. Once green, the rolling deploy on the host pulls the new image
#    and runs health checks before retiring the old container.
```

The deploy workflow will **auto-rollback** if the health check fails.
If the auto-rollback also fails, see section 4 (Rollback).

### Database migrations

Migrations live in `services/pse-inventory/migrations/`. They are
applied by the container at first boot if the schema is empty
(see `postgres-init/` in the production compose).

For schema changes after launch:

```bash
# 1. Add a new migration file: 200_<description>.py
#    It must be idempotent and safe to run against a live database.

# 2. Test it on staging first
psql "$PSE_STAGING_DATABASE_URL" -f services/pse-inventory/migrations/200_<description>.py

# 3. Schedule a maintenance window
# 4. Apply to production
psql "$PSE_DATABASE_URL" -f services/pse-inventory/migrations/200_<description>.py
```

---

## 4. Rollback

### Frontend

Vercel keeps every deploy for 30 days. To roll back:

```bash
# Option A: from the Vercel dashboard
#   Deployments → select the last good one → "Promote to Production"

# Option B: from the CLI
vercel rollback https://pilotsalesdistribution.com
```

This completes in <30 seconds.

### Inventory API

The publish pipeline keeps the last 10 snapshots in
`services/pse-inventory/data/history/`. To roll back to a previous
snapshot:

```bash
# List available snapshots
ls -lt services/pse-inventory/data/history/ | head

# Roll back
./scripts/pse-inventory-rollback.sh \
    --to services/pse-inventory/data/history/snapshot-2026-08-01.json
```

If the API container itself is broken, redeploy the previous tag:

```bash
git tag --list 'v*' | sort -V | tail -5       # see recent tags
git checkout v4.0.0
./scripts/redeploy-api.sh v4.0.0
```

### Database

Database backups live in `services/pse-inventory/data/backups/` and in
the `BACKUP_S3_BUCKET` (S3-compatible object store). To restore:

```bash
# 1. List backups
./scripts/pse-inventory-backup.sh list

# 2. Restore to staging first (NEVER restore directly to production)
./scripts/pse-inventory-restore.sh \
    --from backups/2026-08-01.dump \
    --target "$PSE_STAGING_DATABASE_URL"

# 3. Verify staging is functional, then restore to production
./scripts/pse-inventory-restore.sh \
    --from backups/2026-08-01.dump \
    --target "$PSE_DATABASE_URL"
```

The restore script is fail-closed: it refuses to overwrite a database
that has received writes in the last 5 minutes.

---

## 5. Database backups

Backups run **daily at 03:00 UTC** via the host's cron:

```cron
0 3 * * * /opt/pse-inventory/bin/backup.sh >> /var/log/pse/backup.log 2>&1
```

The script:

1. Dumps Postgres to `/backups/<date>.dump` (compressed with gzip).
2. Encrypts with `BACKUP_ENCRYPTION_PASSPHRASE` (AES-256).
3. Uploads to `s3://$BACKUP_S3_BUCKET/pse-distribution/db/<date>.dump.enc`.
4. Deletes local backups older than 7 days.
5. Deletes S3 backups older than 90 days (configurable).

Verify yesterday's backup at least once a week:

```bash
./scripts/pse-inventory-restore.sh --verify backups/$(date -u -d 'yesterday' +%Y-%m-%d).dump
```

If the verify step fails, the on-call operator is paged. **Do not
ignore a backup failure.**

---

## 6. Monitoring & alerting

### What's monitored

| Signal | Source | Alert threshold |
|---|---|---|
| Site uptime (HTTP 200) | UptimeRobot (5 min interval) | 1 failure → page |
| API readiness | `/internal/readyz` | 3 consecutive failures → page |
| API latency (p95) | Prometheus | > 800ms for 5 min → ticket |
| Error rate (5xx) | Prometheus | > 1% in 5 min → page |
| Inventory snapshot age | `/api/inventory` `snapshot.generated_at` | > 10 min → page |
| Database size | Postgres `pg_database_size` | > 80% capacity → ticket |
| Valkey memory | `INFO memory` | > 200 MB → ticket |
| SSL cert expiry | External cert monitor | < 14 days → page |
| Backup freshness | Backup script log | No fresh backup in 26 hours → page |

### Where alerts go

- **Critical (page):** PagerDuty → on-call rotation
- **High (ticket):** Sentry + Linear ticket
- **Info:** Slack #pse-ops (no notification)

### Dashboards

- **Grafana** (operator-only): <https://grafana.internal/grafana/d/pse>
  Panels: request rate, latency, error rate, snapshot age, DB size,
  Valkey memory, container restarts.

- **Sentry** (operator + admins): <https://sentry.io/pse-distribution>
  Filters: production env only by default.

### Logs

- Frontend access log: shipped to Loki via the JSON formatter in
  `deploy/nginx.conf`. Search: `{app="pse-storefront"} | json | status >= 500`
- Inventory API: stdout JSON. Picked up by Promtail → Loki.
  Search: `{app="pse-inventory"} | json | level="error"`

---

## 7. TLS / HSTS

| Cert | Where | Notes |
|---|---|---|
| Frontend (Vercel) | Auto-provisioned by Vercel for `pilotsalesdistribution.com` and `www.pilotsalesdistribution.com`. Renewal is automatic. | Enable HSTS at the domain level: Settings → Domains → select domain → HSTS → enable. Max-age 1 year, include subdomains, preload. |
| Inventory API (self-hosted) | Caddy auto-provisions via Let's Encrypt (DNS-01 challenge). Renewal is automatic. | Caddyfile already sets HSTS preload — confirm the edge is reachable on :80 for the challenge. |

### HSTS preload

Once the site has been running on HTTPS with HSTS for at least 60 days
without a security incident, submit the domain to the HSTS preload
list: <https://hstspreload.org>. This bakes the policy into browsers
so even a first visit to the domain is forced over HTTPS.

## 8. Incident response

| Sev | Definition | Response time | Who |
|---|---|---|---|
| **SEV-1** | Site down, checkout broken, data loss, security incident | 5 min, page primary | On-call + founder |
| **SEV-2** | Degraded experience (slow, partial outage, broken feature) | 30 min, ticket | On-call |
| **SEV-3** | Minor bug, cosmetic, single-user | Next business day | Backlog |

### SEV-1 checklist

```text
1. Acknowledge the page (PagerDuty or Slack /pse-incidents).
2. Open the incident channel:  /pse-incident YYYY-MM-DD-<short-name>
3. Snapshot the current state:
     - date, time, on-call name
     - what the alert said
     - what you see in Grafana / Sentry
4. Mitigate first, diagnose second. Common mitigations:
     - Frontend down?    Vercel rollback (section 4)
     - API down?         API rollback (section 4)
     - Database down?    Check managed-service status page first
     - High error rate?  /admin-dashboard → Settings → Toggle "Maintenance mode"
5. Post status update to the incident channel every 15 min
   until mitigated.
6. After mitigation, schedule a post-mortem within 48h.
7. File the post-mortem in docs/post-mortems/ (create the dir if new).
```

### Post-mortem template

```markdown
# Post-mortem: <short name>

- Date: YYYY-MM-DD
- Sev: 1 / 2 / 3
- Duration: HH:MM (from first alert to mitigation)
- On-call: <name>

## Summary
One-paragraph plain-English summary.

## Impact
Who was affected, for how long, how they noticed.

## Timeline (UTC)
- HH:MM — what happened
- HH:MM — what we did
- HH:MM — mitigation complete

## Root cause
The actual reason it broke, with evidence (logs, commit, runbook step).

## What went well
- ...

## What went wrong
- ...

## Action items
- [ ] (owner, deadline) concrete change to prevent recurrence
```

---

## 9. Common failure modes

### Symptom: "503 — snapshot unavailable"

The active snapshot file is missing or unreadable.

```bash
# 1. Check the file
ls -la /data/current.json /data/history/ | head

# 2. If the active is missing, promote the newest archive
./scripts/pse-inventory-rollback.sh --to $(ls -t /data/history/*.json | head -1)

# 3. Check why it disappeared
journalctl -u pse-inventory --since "1 hour ago" | grep -iE "snapshot|publish|error"
```

If the cause was a failed publish, fix the publisher before re-running
(see `services/pse-inventory/publish_snapshot.py`).

### Symptom: "429 — rate limit"

You or your monitoring are over the per-minute cap. Increase the
limit in `.env` (`PSE_RATE_LIMIT_PER_MINUTE`) and redeploy the API.

If it's a *real* attack, enable the `BLOCKED_IPS` env var (comma-
separated CIDRs) and add the IPs to the firewall at the edge.

### Symptom: Vercel build failed

```bash
# Get the build log
vercel inspect https://pilotsalesdistribution.com --logs

# Common causes:
#   - Lint error in a new HTML file       → fix the file
#   - Missing favicon referenced          → add the file
#   - Import from a file that .gitignore-d→ remove the .gitignore entry
#   - Security header test failed         → check vercel.json CSP
```

### Symptom: Inventory API returns stale data

```bash
# 1. Check the snapshot timestamp
curl -fsS https://inventory.pilotsalesdistribution.com/api/inventory?limit=1 \
    | jq '.snapshot.generated_at, .snapshot.records'

# 2. If older than 10 min, the publisher is stuck
ssh pse-prod "sudo systemctl status pse-publisher"

# 3. If the publisher is failing, check the publish report
ssh pse-prod "ls -lt /data/publish_reports/ | head"
```

### Symptom: Firebase Auth errors

```bash
# 1. Check Firebase status
open https://status.firebase.google.com

# 2. Check the auth provider config
#    Firebase Console → Authentication → Sign-in method
#    Make sure Email/Password and Google are still enabled.

# 3. Check the auth domain matches
#    Firebase Console → Authentication → Settings → Authorized domains
#    Must include: pilotsalesdistribution.com, www.pilotsalesdistribution.com
```

### Symptom: Email is not being delivered

```bash
# 1. Check the Resend dashboard
open https://resend.com/emails

# 2. Check the form-submit endpoint
curl -fsS -X POST https://formsubmit.co/ajax/admin@pilotsalesdistribution.com \
    -H 'Content-Type: application/json' \
    -d '{"_subject":"test","message":"hi"}'

# 3. Check the From: address is verified
#    Resend → Domains → verify the sending domain
```

---

## 10. Security incident

If you suspect a breach (unauthorised access, data leak, etc.):

1. **Do not** post details in public channels.
2. Page the security on-call via PagerDuty (service: `pse-security`).
3. Preserve evidence: snapshot the database, save logs, capture the
   affected user's profile.
4. Rotate all secrets (Firebase, Resend, Postgres, Valkey, HMAC keys)
   using the operator password manager.
5. Within 72h, file a regulatory disclosure if user data was exposed
   (GDPR / equivalent). Coordinate with legal.

The full security policy is in `SECURITY.md` at the repo root
(generated from `vendor/pse-inventory-packet/SECURITY.md`).
