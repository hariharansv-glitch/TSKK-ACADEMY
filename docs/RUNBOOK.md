# Runbook

Operational recipes for the on-call engineer. Every entry assumes SSH access to the production host and read-access to logs.

---

## Table of contents

1. [Site is down](#1-site-is-down)
2. [Login fails for everyone](#2-login-fails-for-everyone)
3. [Attendance QR scans not registering](#3-attendance-qr-scans-not-registering)
4. [Payments not showing up](#4-payments-not-showing-up)
5. [PDFs are blank / corrupted](#5-pdfs-are-blank--corrupted)
6. [Emails / SMS / WhatsApp not delivered](#6-emails--sms--whatsapp-not-delivered)
7. [Push notifications not received](#7-push-notifications-not-received)
8. [Disk full](#8-disk-full)
9. [Database high CPU](#9-database-high-cpu)
10. [Roll back a deployment](#10-roll-back-a-deployment)

---

## 1. Site is down

```bash
./scripts/healthcheck.sh
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 nginx backend frontend
```

Likely causes:

- **Nginx cert expired** → `certbot renew && docker exec tskk-nginx nginx -s reload`
- **Backend crashed on boot** → env-validation error. `docker logs tskk-backend` will show the missing key.
- **Postgres not reachable** → check `POSTGRES_PASSWORD` matches between the DB volume and the app env.

---

## 2. Login fails for everyone

- Check clock skew: JWT verification is time-sensitive. `timedatectl status`.
- Verify `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` haven't been rotated without restarting the backend.
- Look for a rate-limit event in Nginx access log: `429` on `/api/v1/auth/login`.

---

## 3. Attendance QR scans not registering

- Confirm `QR_SIGNING_SECRET` did not change (regenerating it invalidates existing student QR codes).
- Inspect a specific scan: `docker exec -it tskk-backend node -e "…"` or check `audit_logs` for the attempted request.
- `AttendanceService.scan()` rejects duplicates within the same working day. If a legitimate re-scan is needed, delete the earlier record.

---

## 4. Payments not showing up

1. Check the Razorpay dashboard for the payment ID.
2. Verify the webhook was delivered — Razorpay shows the HTTP response.
3. `SELECT * FROM payments WHERE razorpay_payment_id = '…';` on Postgres.
4. If missing: `POST /fees/webhooks/razorpay/replay` (super-admin only) to re-fetch and reconcile.

---

## 5. PDFs are blank / corrupted

- Puppeteer needs enough RAM. If OOM: `docker stats` will show `tskk-backend` at 100 %. Increase the container memory limit or move PDF rendering to a dedicated worker.
- Fonts missing: rebuild the backend image so the Dockerfile pulls the fontconfig update.

---

## 6. Emails / SMS / WhatsApp not delivered

- **Email**: check the SMTP provider dashboard. Common cause: sender domain not verified.
- **SMS**: Twilio → `Console → Monitor → Logs`. Common cause: unverified destination in trial mode.
- **WhatsApp**: Meta Business Suite → `Message templates`. Template must be approved and match `template_id` used by the backend.

Retry a specific notification:

```sql
UPDATE notifications SET status = 'PENDING' WHERE id = '…';
```

The dispatcher queue picks it up within seconds.

---

## 7. Push notifications not received

- Confirm the browser has granted permission.
- Verify `VAPID_PUBLIC_KEY` in `.env` matches the one served by `GET /notifications/push/public-key`.
- Push subscriptions get invalidated after several months. The dispatcher marks them `410 Gone` and removes them — the user must re-subscribe.

---

## 8. Disk full

```bash
docker system df
docker system prune -f --filter "until=48h"
```

MinIO buckets contain user uploads — never `prune` those. Instead, expand the volume or move older objects to a cheaper tier.

Postgres WAL bloat: `docker exec tskk-postgres psql -U tskk_admin -c "SELECT pg_size_pretty(pg_database_size('tskk_academy'));"`.

---

## 9. Database high CPU

```bash
docker exec tskk-postgres psql -U tskk_admin -d tskk_academy -c \
  "SELECT pid, now() - query_start AS runtime, state, query FROM pg_stat_activity ORDER BY runtime DESC LIMIT 10;"
```

- Kill runaways: `SELECT pg_cancel_backend(<pid>);`
- Missing index? `EXPLAIN ANALYZE` the slow query. Never add an index directly in production — write a Prisma migration and deploy.

---

## 10. Roll back a deployment

```bash
git log --oneline -n 5
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
./scripts/healthcheck.sh
```

If schema migrations were part of the bad release, either roll them forward (`prisma migrate` with a fix) or, as a last resort, restore last night's snapshot via `scripts/restore.sh`.

---

## On-call escalation

| Severity | Response | Contact |
|----------|----------|---------|
| P0 — total outage | Immediate | `#tskk-oncall` Slack, then phone |
| P1 — degraded service | < 30 min | `#tskk-oncall` Slack |
| P2 — non-critical bug | Business hours | JIRA ticket |
