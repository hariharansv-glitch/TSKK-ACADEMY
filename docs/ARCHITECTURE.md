# Architecture

This document explains how the TSKK Academy Platform is put together, why the boundaries live where they do, and how requests flow through the system.

---

## 1. High-level view

```
                    ┌────────────────┐
                    │   Nginx (TLS)  │
                    └──────┬─────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        Frontend      Backend      Public /verify
        (Next.js)     (NestJS)     (Next.js SSR)
              │            │
              │            │  Prisma ORM
              │            ▼
              │        PostgreSQL
              │            │
              │            ├─────────► Redis (BullMQ queues, cache, rate-limit)
              │            ├─────────► MinIO (S3 API)  photos, PDFs, videos
              │            ├─────────► Razorpay
              │            ├─────────► Nodemailer / Twilio / Meta WhatsApp / Web-Push
              ▼            ▼
        Browser / PWA — QR scanner, offline shell, push notifications
```

---

## 2. Multi-tenancy model

- Every domain table carries an `academyId` foreign key.
- The `TenantGuard` reads `req.user.academyId` from the JWT and refuses any query that touches a resource with a different `academyId` (super-admins are exempt).
- Repositories inject the current tenant into `where` clauses, so a bug in a controller cannot leak data across academies.

```
JWT ──► JwtStrategy ──► CurrentUser ──► RolesGuard ──► PermissionsGuard ──► TenantGuard ──► Controller ──► Service ──► Prisma
```

---

## 3. Backend layering

```
┌───────────────────────────────────────────┐
│ HTTP boundary (Controllers + Zod DTOs)    │
├───────────────────────────────────────────┤
│ Domain services (business rules)          │
├───────────────────────────────────────────┤
│ Infrastructure (Prisma, Redis, MinIO,     │
│ Razorpay, Nodemailer, Puppeteer, Twilio)  │
└───────────────────────────────────────────┘
```

- **Controllers** are thin, only validation + auth + service call.
- **Services** are pure business logic. All side effects (database, external APIs, storage) go through their own thin adapters.
- **DTOs** are Zod schemas → TypeScript types via `z.infer<>`. The `ZodValidationPipe` turns validation failures into HTTP 400 responses with a stable error shape.
- **Global filters** (`AllExceptionsFilter`, `PrismaExceptionFilter`) normalise error responses.
- **Global interceptors** (`TransformInterceptor`, `TimeoutInterceptor`, `LoggingInterceptor`) wrap all responses in `{ success, data, meta?, requestId, timestamp }`.

---

## 4. Frontend layering

```
Route (app/…) ──► Layout (Auth guard, shell)
                  │
                  ├─ Client component
                  │    ├─ TanStack Query hook  ──► axios (api-client)
                  │    ├─ Zustand store         ──► session, theme
                  │    └─ shadcn/ui + Tailwind
                  │
                  └─ Server component (public /verify)
```

- **`api-client.ts`** owns the request/response envelope. Every 401 triggers a single-flight refresh-token exchange.
- **`auth-store.ts`** persists the session to `localStorage`, exposes `hasRole` / `hasPermission` helpers for the sidebar and route guards.
- **Route groups**: `(auth)`, `dashboard`, `platform`, `parent`, `student` each have their own layout and permission gate.

---

## 5. Attendance QR flow

1. Backend generates a signed payload `TSKK|<academyId>|<studentCode>|<hmac>` at student creation.
2. Payload rendered to a QR PNG, uploaded to MinIO, URL stored on the student.
3. On scan, `AttendanceService.scan()` re-computes the HMAC and rejects mismatches.
4. If the student is in the correct academy and within grace period, records `PRESENT`; otherwise `LATE`.
5. Duplicates in the same session are rejected.

---

## 6. Fee / payment flow

- **Invoice** → `lineItems[]` + tax + discount + late fee = `totalPaise`.
- **Payment** rows accumulate against an invoice. `balancePaise` and `status` (`PENDING → PARTIAL → PAID`) are re-derived inside a transaction.
- **Razorpay**: `POST /fees/invoices/:id/pay/initiate` creates an order; the client opens Checkout; the resulting signature is verified server-side by `RazorpayService`. A signed webhook path also updates payment status idempotently.
- **Receipts**: Puppeteer renders `templates/receipt.hbs` and uploads the PDF to MinIO. The URL is returned to the client.

---

## 7. Certificates & belt exams

- Grading a belt exam optionally auto-issues a certificate.
- Each certificate has a unique `verificationCode`.
- The public route `/verify/[code]` (served by Next.js) queries `GET /public/certificates/:code/verify` and shows a rich status card (valid / revoked / expired).

---

## 8. Notifications

`NotificationsService.send()`:
- Resolves recipient IDs from user IDs and/or roles.
- Fans out to channels the academy has enabled (`AcademySetting`).
- Writes a `Notification` row per (recipient, channel) tuple.
- Dispatches to Nodemailer, Twilio, Meta WhatsApp, Web-Push. Push subscriptions marked `410 Gone` are removed.

---

## 9. Cross-cutting concerns

- **Audit logs**: every mutating service writes to `audit_logs` via `AuditLogService` with before/after snapshots and the `requestId`.
- **Rate-limiting**: Nginx enforces coarse limits per IP; `@nestjs/throttler` enforces per-user auth-endpoint limits.
- **Config**: a single Zod schema (`env.validation.ts`) is applied at boot; missing or malformed env crashes the process on start.
- **Secrets**: never in code. Provided via `.env` / Docker secrets / Jenkins credentials.

---

## 10. Extensibility

Adding a new academy vertical (e.g. Karate) requires **no schema changes**:
- Update `belt_levels` enum if the new discipline has different ranks.
- Adjust the certificate template.
- Everything else — students, fees, attendance, events — is agnostic.
