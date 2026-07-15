# Deployment

This guide walks through deploying the TSKK Academy Platform to a single production host running Docker Compose behind Nginx. The same pattern extends to Kubernetes; see the notes at the end.

---

## 1. Prerequisites on the server

- Ubuntu 22.04 LTS (or any Docker-capable Linux).
- Docker Engine ≥ 24 and the Compose plugin (`docker compose`).
- A registered domain name pointed at the server (A record).
- Ports 80 and 443 open to the internet.
- At least 4 GB RAM and 20 GB disk.

Optional but recommended:

- A separate PostgreSQL server (managed RDS/Cloud SQL) for high-availability deployments.
- A dedicated object store (AWS S3 / DigitalOcean Spaces) instead of MinIO once the platform scales.

---

## 2. Prepare the deployment directory

```bash
sudo mkdir -p /opt/tskk-academy
sudo chown -R "$USER":"$USER" /opt/tskk-academy
cd /opt/tskk-academy
git clone <repo-url> .
```

---

## 3. Environment file

Copy `.env.example` to `.env.production` and fill in **every** field. The critical ones:

| Key | Notes |
|-----|-------|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://academy.yourdomain.com` |
| `API_URL` | `https://academy.yourdomain.com/api` |
| `POSTGRES_*` | Strong password, never the default |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 64+ random bytes each |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Strong values |
| `SMTP_*` | Real transactional SMTP (SES, SendGrid, Postmark…) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | From the Razorpay dashboard |
| `TWILIO_*` | Live credentials, not sandbox |
| `WHATSAPP_*` | Meta Cloud API |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Generated once, kept forever |
| `SUPER_ADMIN_*` | Only used once during first-run seed |

Generate strong secrets:

```bash
openssl rand -base64 64
```

---

## 4. TLS certificates

Use Certbot to obtain a Let's Encrypt certificate, then mount the cert into the Nginx container.

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d academy.yourdomain.com
sudo mkdir -p nginx/certs
sudo cp /etc/letsencrypt/live/academy.yourdomain.com/fullchain.pem nginx/certs/
sudo cp /etc/letsencrypt/live/academy.yourdomain.com/privkey.pem   nginx/certs/
```

Add a cron entry to renew and reload Nginx:

```
0 3 * * * certbot renew --deploy-hook 'docker exec tskk-nginx nginx -s reload'
```

---

## 5. Bring the stack up

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

First-run: apply Prisma migrations and seed the initial data.

```bash
docker compose -f docker-compose.prod.yml exec backend node dist/main.js prisma migrate deploy
docker compose -f docker-compose.prod.yml exec backend node dist/main.js prisma db seed
```

Verify:

```bash
curl -k https://academy.yourdomain.com/api/v1/health
./scripts/healthcheck.sh
```

---

## 6. Post-deployment checklist

- [ ] Change all super-admin, academy-admin, and demo passwords.
- [ ] Confirm outbound email works (`/api/v1/health` includes a mailer probe).
- [ ] Trigger a test payment against Razorpay in test mode.
- [ ] Confirm push notifications work end-to-end with a real device.
- [ ] Configure the nightly backup cron: see `scripts/backup.sh`.
- [ ] Point uptime monitoring (UptimeRobot / Better Stack) at `https://academy.yourdomain.com/api/v1/health`.
- [ ] Enable the Docker restart policy is `always` (verify with `docker inspect`).
- [ ] Set up log shipping (Loki / CloudWatch / Datadog) from the JSON log files.

---

## 7. Zero-downtime upgrades

```bash
git pull
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
```

Nginx keeps existing connections while the containers rotate; new requests are routed to the healthy container.

---

## 8. Backup & restore

Nightly at 02:00 UTC, `scripts/backup.sh` produces a compressed snapshot containing a `pg_dump` and every MinIO bucket. Snapshots live in `/var/backups/tskk/` for 14 days by default.

To restore:

```bash
./scripts/restore.sh /var/backups/tskk/tskk-20260101T020000Z.tar.gz
```

Test the restore procedure at least once per quarter on a staging host.

---

## 9. Scaling notes

- **Multiple backend replicas**: safe as long as they share the same Postgres, Redis and MinIO. Session state lives in Redis + JWT, no sticky-sessions needed.
- **Bigger Postgres**: move to a managed service. Set `DATABASE_URL` accordingly and remove the `postgres` service from Compose.
- **CDN**: put CloudFront / BunnyCDN in front of `/_next/static/` and `/media/`.
- **Kubernetes**: the images are stateless; wrap them in a Helm chart with Postgres, Redis and MinIO as external services. Ingress replaces Nginx.

---

## 10. Rollback

If a deployment misbehaves:

```bash
docker compose -f docker-compose.prod.yml down
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml up -d
# Restore last night's snapshot only if there were destructive migrations
./scripts/restore.sh /var/backups/tskk/<latest>.tar.gz
```

Prisma migrations are additive by convention; schema changes that drop columns must go through a two-step "expand then contract" release.
