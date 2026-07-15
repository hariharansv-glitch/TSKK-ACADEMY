# REST API

Base URL: `https://academy.yourdomain.com/api/v1`

Full, interactive documentation is generated from the code and served at:

```
https://academy.yourdomain.com/docs
```

The rest of this file documents cross-cutting conventions that Swagger does not capture.

---

## Conventions

### Response envelope

Every successful response is wrapped:

```json
{
  "success": true,
  "data":   <payload>,
  "meta":   <pagination or nothing>,
  "requestId": "01HZ…",
  "timestamp": "2026-07-14T09:31:00.000Z"
}
```

Errors:

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "email must be a valid email",
  "details": [ … ],
  "requestId": "01HZ…",
  "timestamp": "…"
}
```

### Authentication

- `POST /auth/login` → `{ accessToken, refreshToken }`. Access token TTL is 15 minutes.
- Send `Authorization: Bearer <accessToken>` on every protected request.
- On `401`, POST the refresh token to `/auth/refresh` to receive a new pair. Refresh tokens rotate — the old one is invalidated.

### Pagination

Any list endpoint accepts:

- `page` (default 1)
- `pageSize` (default 20, max 100)
- `search` (free-text)
- `sortBy` (endpoint specific)
- `sortDir` (`asc` | `desc`)

Response includes:

```json
{
  "data":  [ … ],
  "meta": {
    "page": 1, "pageSize": 20, "total": 123,
    "totalPages": 7, "hasNext": true, "hasPrevious": false
  }
}
```

### Money

All monetary fields are integer **paise** (`₹ × 100`). The frontend converts to rupees for display.

### Dates

- Request: ISO 8601 (`2026-07-14T09:31:00.000Z`) or `YYYY-MM-DD` for pure dates.
- Response: always ISO 8601 with `Z` suffix.

---

## Grouped endpoints

| Group | Prefix | Purpose |
|-------|--------|---------|
| Auth | `/auth` | Register, login, refresh, password reset, email verify, sessions |
| Users | `/users` | Super-admin CRUD over users |
| Academies | `/academies` | Super-admin CRUD over academies, subscriptions, plans |
| Branches | `/branches` | Physical branch locations within an academy |
| Students | `/students` | Enrolment, profile, photo, QR |
| Parents | `/parents` | Guardians, link/unlink children |
| Instructors | `/instructors` | Staff records, schedule, salary |
| Attendance | `/attendance` | QR scan, manual entry, batch, holidays, reports |
| Fees | `/fees` | Plans, invoices, payments (offline + Razorpay), receipts |
| Belts | `/belts` | Schedule + grade belt exams |
| Certificates | `/certificates` | Issue, revoke, list; **public** verification |
| Events | `/events` | Workshops, competitions, registrations |
| Learning | `/learning` | Videos, documents, assignments, submissions |
| Inventory | `/inventory` | Items, stock adjustments, orders |
| Announcements | `/announcements` | Multi-channel broadcast messages |
| Notifications | `/notifications` | Personal inbox, push subscriptions |
| Reports | `/reports` | Dashboards, attendance, revenue, dropout, belt progression |
| Settings | `/settings` | Per-academy configuration |
| Audit | `/audit` | Read-only audit log |
| Public | `/public` | Non-authenticated endpoints (certificate verify) |

---

## Cross-tenant safety

Every endpoint that touches tenant data is behind `TenantGuard`. If a token's `academyId` does not match the resource's `academyId`, the response is **404 Not Found** (deliberately — leaking "forbidden" would reveal existence).

---

## Rate limits

| Endpoint | Rate |
|----------|------|
| `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` | 5 requests / sec / IP |
| Any authenticated route | 20 requests / sec / IP |
| Webhooks | Unlimited (signature-verified) |

Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header.

---

## Webhooks

Razorpay webhook:

```
POST /fees/webhooks/razorpay
X-Razorpay-Signature: <hex>

<payload>
```

Signature is verified with `RAZORPAY_WEBHOOK_SECRET`. Duplicate deliveries are safe — payments are idempotent by `razorpay_payment_id`.

---

## Sample: enrol a student

```bash
curl -X POST https://.../api/v1/students \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName":"Aravind","lastName":"Kumar",
    "gender":"MALE","dateOfBirth":"2012-05-04",
    "admissionDate":"2026-07-14",
    "email":"aravind@example.com","phone":"+919000000000"
  }'
```

---

## Sample: verify a certificate (public)

```bash
curl https://.../api/v1/public/certificates/8F3A-XY12-QR/verify
```

Returns `{ status: "valid" | "revoked" | "expired" | "not-found", certificate: { … } }`.
