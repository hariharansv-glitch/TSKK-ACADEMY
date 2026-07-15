# Contributing

Thanks for helping build the TSKK Academy Platform. This guide keeps the codebase consistent and safe.

---

## 1. Branching

- `main` is protected — deployable at all times.
- Feature branches: `feat/<slug>`, bug fixes: `fix/<slug>`, chores: `chore/<slug>`.
- Rebase, don't merge, when syncing with `main`.
- One PR = one logical change. Small PRs merge fast.

---

## 2. Commit messages

We follow Conventional Commits:

```
feat(students): add bulk import from CSV
fix(fees): correct paise → rupee rounding in receipts
docs(api): document the /verify public endpoint
chore(deps): bump Nest to 10.4.4
```

The subject line is imperative, ≤ 72 characters, no trailing period.

---

## 3. Code style

- **TypeScript strict** everywhere. No `any` unless justified by a comment.
- **Backend**: ESLint + Prettier + `pnpm run lint`. Zod for all input validation.
- **Frontend**: ESLint (`next/core-web-vitals`) + Prettier. Prefer server components; opt into `'use client'` only when needed.
- **File names**: kebab-case (`fee-invoice.service.ts`), classes PascalCase, functions camelCase.
- **Comments**: explain *why*, never restate *what*. Delete redundant comments.

---

## 4. Testing

| Layer | Tool | Location |
|-------|------|----------|
| Unit  | Jest + ts-jest | `backend/src/**/*.spec.ts` |
| E2E   | Jest + supertest | `backend/test/**/*.e2e-spec.ts` |
| Frontend | (Playwright, coming) | `frontend/tests/**` |

Run:

```bash
pnpm test                   # unit
pnpm test:cov               # with coverage
pnpm test:e2e               # integration
```

New services or utilities must ship with tests. Coverage thresholds:

- `common/utils`: 90 %
- Domain services: 70 %

---

## 5. Database changes

1. Modify `prisma/schema.prisma`.
2. Run `pnpm prisma migrate dev --name <slug>` locally.
3. Commit both the schema and the generated migration files.
4. In review: reviewer verifies the migration is additive (or two-step) and safe to run against production.
5. Never edit an already-merged migration. Add a new one to compensate.

---

## 6. Adding a new module

Backend:

```
src/modules/<name>/
├── dto/<name>.dto.ts        # Zod schemas + inferred types
├── <name>.controller.ts     # HTTP boundary
├── <name>.service.ts        # Business logic
└── <name>.module.ts         # Wiring
```

Register the module in `app.module.ts`. Attach `@UseGuards(JwtAuthGuard, TenantGuard)` unless the endpoint is intentionally public.

Frontend:

```
src/app/dashboard/<name>/
├── page.tsx                 # List
├── new/page.tsx             # Create
└── [id]/page.tsx            # Detail / edit
```

Add a link to `components/app-shell/sidebar-nav.tsx` behind the correct permission.

---

## 7. Security

- Never commit secrets. `.env` files are git-ignored — treat that as sacred.
- New endpoints must default to authenticated. Public endpoints go under `/public/**` and are audited in PR review.
- Money math must use `int` paise, never floats.
- Any endpoint that touches PII must write an `audit_logs` row.

---

## 8. Reviews

- At least one approving review before merge.
- All CI checks green (lint, typecheck, tests, image build).
- The author (not the reviewer) presses "Merge".
- Squash-merge — the PR title becomes the commit message.

---

## 9. Releases

- `main` auto-deploys to staging.
- Tag `v<major>.<minor>.<patch>` to promote to production.
- Update `CHANGELOG.md` in the same PR that bumps the version.

---

Happy shipping.
