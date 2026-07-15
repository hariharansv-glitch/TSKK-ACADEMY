# Changelog

All notable changes to the TSKK Academy Platform are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Frontend edit pages** for student, parent, instructor, event, inventory item, branch — with pre-filled forms and role/permission guards.
- **Fee plans management** UI (`/dashboard/fees/plans`) with in-place create/edit/toggle/delete.
- **Batches module** (backend + frontend): classes CRUD, batches CRUD, weekly schedule editor, roster enrolment/removal, capacity enforcement, and Assignments tab.
- **Assignments** UI: instructor grading (`/dashboard/assignments/[id]`), student submission (`/student/assignments/[id]`) with `/learning/me/assignments` endpoints.
- **Student portal**: printable QR ID card (`/student/qr`), learning library with belt-gating, assignments overview.
- **Razorpay checkout**: reusable `openRazorpayCheckout` helper and “Pay online” flow on invoice detail with server-side signature verification.
- **Super Admin**: platform academies list/create/detail with suspend/reactivate/delete and subscription overview.
- **User management** (`/dashboard/settings/users`): invite user, change role, suspend/reactivate, delete.
- **Session management** (`/dashboard/settings/sessions`): list active sessions with device/UA and revoke individually.
- **Attendance holidays** UI with annual repeat and **batch daily report** with CSV export.
- **Inventory orders (POS)**: list, status filter, POS-style cart at `/dashboard/inventory/orders/new`, and order detail with status transitions.
- **Backend `/students/me`** and **`/students/me/qr.png`** endpoints for the student portal.
- **New `BatchesModule`** in NestJS with classes + batches + roster APIs, wired to permissions and audit log.
- **Seed permissions** expanded to cover every controller-level `@Permissions()` reference (batch, assignment, document, notification, audit, settings.view, etc.).
- **Playwright** frontend smoke tests (`e2e/`) with a config that auto-launches `next dev` and optional authenticated flow gated on env vars.
- **Reusable `Tabs`** component (Radix-based) and `apiBlobRequest` helper for binary responses (QR/PDF).
- Reusable `Field`, `FormGrid`, `FormSection` form primitives.
- Production `docker-compose.prod.yml`, Nginx config with TLS + rate limiting, Jenkinsfile CI/CD pipeline.
- Backup, restore, healthcheck and bootstrap scripts under `scripts/`.
- Comprehensive documentation: architecture, deployment, API, runbook, contributing.
- Unit tests for money, hash, QR, password utilities; belt progression rule; attendance status computation; pagination helpers.
- E2E health & auth smoke tests.

### Changed
- `docker-compose.yml` no longer overrides the frontend/backend `command`; the Dockerfile stages own their entrypoints for consistency.
- Sidebar navigation adds Batches; Settings page surfaces Users and Sessions links.

## [1.0.0] — 2026-07-14

### Added
- Multi-tenant NestJS backend with Prisma, Postgres, Redis, MinIO.
- Full domain modules: auth, users, academies, branches, students, parents, instructors, attendance, fees (Razorpay), belts, certificates (QR verification), events, learning, inventory, announcements, notifications (email/SMS/WhatsApp/push), reports, settings, audit.
- Next.js 15 frontend scaffold: authenticated dashboards for admin/instructor/receptionist/accountant, dedicated portals for parent/student, public certificate verification.
- PDF generation via Puppeteer + Handlebars for receipts and certificates.
- Local Docker Compose stack for development.
