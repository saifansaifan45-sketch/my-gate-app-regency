# Regency Salma — Zobay Neighbourhood V0.0.1

> **Production-recovered community OS** — Expo + React Native + Express + Prisma + PostgreSQL. From messy junior repo → reproducible `main` with `34 tables` via `migrate deploy`, `42/42` Jest, `header` auth, no `db push`.

[![main](https://img.shields.io/badge/main-5976a96-143D2A)](https://github.com/Strato-Techcorp/my-gate-app-regency) [![v0.0.1](https://img.shields.io/badge/v0.0.1-758a563-E9EEE7)](https://github.com/Strato-Techcorp/my-gate-app-regency/releases/tag/v0.0.1) [![migrations](https://img.shields.io/badge/migrations-2%20applied-256B43)](backend/prisma/migrations) [![tests](https://img.shields.io/badge/tests-42%2F42-256B43)](backend/tests) [![typecheck](https://img.shields.io/badge/tsc-backend%20%7C%20frontend-0-143D2A)](#verification)

**Live baseline:** `origin/main@5976a96` (post-`v0.0.1` reproducibility fix) — `v0.0.1` tag at `758a563`.

---

## What this is

Regency Salma is a **residential community operating system** — not a MyGate clone. It started as a junior-built internal app for one township and was systematically recovered into a **reproducible, tested, production-safe `main`**:

```text
Messy repo (11 remotes, divergent schemas, 33 vs 34 tables)
  → Inventory → One canonical main → Fresh DB → 34 tables → 42/42
  → Security hardening (revoke/pause/renew/leadership/register/purpose)
  → Chat (header auth) + Navigation + UI
  → V0.0.1 @ 758a563 → 5976a96 (frontend contract fix)
```

**Current V0.0.1 (5976a96):**
- **Backend:** Express + Prisma (34 tables), JWT `tokenVersion`, `loginSecurity` Map + `express-rate-limit`, `PermanentPass` 28-day, `Visitor` `PENDING→CHECKED_OUT` + `purpose` required, `REVOKE/PAUSE` cascade, `renew` guard, `requireLeadership` strict, `chat` header `Authorization: Bearer` (never `?token=`).
- **Frontend:** Expo Router 57 + React Native 0.86, `history.tsx:174` state-aware, `fix/ui-layout-polish` superset (`QuickActionsRadial`, `Skeleton`, `PremiumPressable`), `app/(app)/chat` REST polling via `api/client` header.
- **DB:** PostgreSQL 16, `2 migrations` (`20260826093513_initial_schema` + `20260912084413_add_permanent_pass`), `migrate deploy ONLY`, **never `db push`**.
- **Tests:** `42/42` (`visitors` `visitor-gate-approval` `household-revoke` `household-paused` `household-renew` `leadership-auth` `register-authz` `visitor-purpose` `chat`).

---

## Architecture

```text
               Expo Router (app)
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Resident      Manager     Workforce (Security)
   Home/Visitors  Tickets     Gate /visitors/permanent-pass/:passId/check-in
   Community     Personnel   Attendance
   Chat (header) Leadership  Tasks
        │            │            │
        └────────────┼────────────┘
                     │
              Express API (backend/src)
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
     Auth        Visitors     Household
  JWT+Refresh  OTP 6-digit  Member PAUSED/REVOKED
  tokenVersion  purpose    PermanentPass ACTIVE/PAUSED/REVOKED
  rate-limit    validUntil  28d + renew guard
        │            │            │
        └────────────┼────────────┘
                     │
               Prisma Client 7.9
                     │
               PostgreSQL 16 (34 tables)
```

**Domain (canonical, not flattened):**
```text
User ── Membership (user+community+role+status)
  ├── UnitOwnership (ACTIVE) ── Unit ── Community
  ├── UnitResidency (ACTIVE/PAUSED/REVOKED, OWNER/TENANT/FAMILY_MEMBER)
  └── HouseholdMember (ACTIVE/PAUSED/REVOKED) ── PermanentPass (householdMemberId → status ACTIVE/PAUSED/REVOKED/EXPIRED)
        └── Visitor (PENDING→APPROVED→CHECKED_IN→CHECKED_OUT + EXPIRED/REVOKED/REJECTED, purpose required, otp 6-digit)
```
See `docs/canonical-schema-decision.md` (Status: Proposed → Accepted after `26325da`).

---

## Security invariants (proven, not claimed)

| Invariant | Endpoint | Test |
|-----------|----------|------|
| `REVOKED` member → linked `ACTIVE` passes → `REVOKED` → gate `400` | `PATCH /household/members/:id/status` → `POST /visitors/permanent-pass/:passId/check-in` | `household-revoke.test.ts:1` |
| `PAUSED` member → `ACTIVE` passes → `PAUSED` → gate `400` | same | `household-paused.test.ts:1` |
| `PAUSED/REVOKED` member → `POST /household/permanent-passes/:id/renew` → `400` | `household-renew.test.ts:3` |
| `requireLeadership` strict — `MANAGER/WORKFORCE/RESIDENT/OWNER` → `403`, `LEADERSHIP` → `200` | `GET /community/memberships/pending` | `leadership-auth.test.ts:5` |
| `POST /auth/register {role:MANAGER}` → `PENDING` not `APPROVED` | `auth.ts:246` | `register-authz.test.ts:2` |
| `purpose` required on `POST /visitors` | `visitors.ts:37` | `visitor-purpose.test.ts:2` |
| `chat` header `Authorization: Bearer` (never `?token=`), `PAUSED/REVOKED` → `404` | `GET /chat/channels` / `POST /chat/channels/:channelId/messages` | `chat.test.ts:5` |
| Cross-community → `404` (not `403`) — intentionally invisible | `GET /visitors/gate` `GET /chat/channels/:id/messages` | `visitors.test.ts:15` |

---

## Quick start (reproducible, not `db push`)

**Prerequisites:** Node 20+, npm 10+, PostgreSQL 16 (or Docker), Expo Go / simulator.

```bash
# 1. Clone at V0.0.1
git clone https://github.com/Strato-Techcorp/my-gate-app-regency.git
cd my-gate-app-regency
git checkout 5976a96  # or v0.0.1 tag 758a563 for release

# 2. Backend deps + DB (disposable 5433 example)
cd backend
npm ci --legacy-peer-deps

# Create disposable Postgres (or use your own DATABASE_URL)
docker run --name regency-salma-test-db \
  -e POSTGRES_USER=regency_test -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=regency_salma_test -p 5433:5432 -d postgres:16
until docker exec regency-salma-test-db pg_isready -U regency_test -d regency_salma_test; do sleep 1; done

printf 'DATABASE_URL=postgresql://regency_test:postgres@127.0.0.1:5433/regency_salma_test\nJWT_ACCESS_SECRET=dev-access-secret-change-me\nJWT_REFRESH_SECRET=dev-refresh-secret-change-me\nPORT=3000\nCORS_ALLOWED_ORIGINS=http://localhost:8081\nFRONTEND_URL=http://localhost:8081\n' > .env

npx prisma generate
npx prisma migrate deploy  # 2 migrations → 34 tables, PermanentPass present (never db push)
npx tsc --noEmit           # backend 0
npm run dev                # http://localhost:3000/health → {"status":"ok","database":"connected"}

# 3. Frontend
cd ../frontend
npm ci --legacy-peer-deps
printf 'EXPO_PUBLIC_API_URL=http://localhost:3000\n' > .env  # use 192.168.x.x for physical device
npm run typecheck          # 0
npm start                  # scan QR or npm run web
```

**Verify (fresh DB, no `db push`):**
```bash
cd backend
npx prisma migrate status # 2 migrations, up to date
docker exec regency-salma-test-db psql -U regency_test -d regency_salma_test -c "SELECT to_regclass('public.\"PermanentPass\"');" # "PermanentPass"
npx jest tests/visitors.test.ts tests/visitor-gate-approval.test.ts tests/household-revoke.test.ts tests/household-paused.test.ts tests/household-renew.test.ts tests/leadership-auth.test.ts tests/register-authz.test.ts tests/visitor-purpose.test.ts tests/chat.test.ts --runInBand # 42/42
```

**Why not `npx prisma db push`?** `db push` makes the app work by syncing schema directly, but `migrate deploy` proves the *repository* can bootstrap its own DB from `prisma/migrations` history — the production-recovery gate.

---

## Configuration

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | `postgresql://USER:PASS@host:5432/db` — disposable test DB `regency_salma_test` on `5433` |
| `JWT_ACCESS_SECRET` | Yes | Long random — signs short-lived access tokens, checked via `tokenVersion` (`middleware/auth.ts:49`) |
| `JWT_REFRESH_SECRET` | Yes | Different long random — signs refresh tokens (`Session` hashed) |
| `EXPO_PUBLIC_API_URL` | Yes (frontend) | `http://localhost:3000` or `http://192.168.x.x:3000` for device |
| `PORT` | No | `3000` |
| `CORS_ALLOWED_ORIGINS` | Recommended | Comma-separated, e.g. `http://localhost:8081` |
| `FRONTEND_URL` | Recommended | For password-reset links |
| `EMAIL_PROVIDER` / `RESEND_API_KEY` / `EMAIL_FROM` | No | `resend` only for prod email |

Never commit `.env`.

---

## API surface (V0.0.1)

**Auth:** `POST /auth/register` (role `MANAGER` → `PENDING`), `POST /auth/login` (rate-limited `ip:email` + `loginSecurity` Map), `POST /auth/refresh` (`tokenVersion`), `GET /auth/me`, `POST /auth/onboarding/*`

**Household:** `GET/POST/DELETE /household/members`, `PATCH /household/members/:id/status` (`ACTIVE/PAUSED/REVOKED` → cascade `ACTIVE` passes), `GET/POST /household/permanent-passes`, `POST /household/permanent-passes/:id/renew` (guard: linked member must be `ACTIVE`), `PATCH /household/permanent-passes/:id/status`

**Visitors/Gate:** `POST /visitors` (`purpose` required, `GUEST` → OTP `6-digit` `visitors.ts:37`), `POST /visitors/:id/approve` (regenerates OTP, resets lock), `POST /visitors/:id/check-in` (OTP 5-attempt lock `429`, `reconcileVisitorLifecycle` before gate), `POST /visitors/permanent-pass/:passId/check-in` (`status ACTIVE` + `validUntil` + `community` check), `GET /visitors/gate` (filters `ACTIVE`), `POST /visitors/unannounced` (resident alert)

**Chat (header auth, P1):** `GET /chat/channels`, `GET /chat/channels/:channelId/messages`, `POST /chat/channels/:channelId/messages` — all `requireAuth` (`Authorization: Bearer`), `canUserAccessChannel` checks `ACTIVE`/`APPROVED`, `PAUSED/REVOKED` → `404`, cross-community → `404` (never `?token=`).

**Community/Manager/Leadership:** `GET /community/memberships/pending` (`requireLeadership` strict), `POST /community/memberships/:id/approve`, `GET /leadership/*`, `GET /manager/*`, `GET /work/*`

See `backend/src/routes/*.ts` for full.

---

## Project layout

```text
frontend/  Expo Router 57 — app/(app)/chat, navigation/history.tsx:174 state-aware, fix/ui-layout-polish superset
backend/   Express — routes, prisma/schema.prisma (34 tables), migrations (2), tests (9 suites 42/42), middleware/auth.ts
docs/      canonical-schema-decision.md (Proposed → Accepted after 26325da), VISITOR_LIFECYCLE.md
```

---

## Production recovery → V0.0.1

This repo was intentionally recovered, not rebuilt:

```text
11 remotes → 1 remote (main) + 16 locals (archaeology library)
migrations: 33 → 34 tables (20260912084413_add_permanent_pass forward, no history rewrite)
tests: 23 → 42 (revoke 1 + paused 1 + renew 3 + leadership 5 + register 2 + purpose 2 + chat 5)
main: 26325da → 66e50b1 (leadership) → 29f01b3 (register) → d3844a7 (purpose) → 90ddd64/5976a96 (chat/navigation/UI)
```

**Branch hygiene:** `main` canonical, `v0.0.1` tag at `758a563`, post-fix `5976a96` is operational `origin/main` (`git clone` reproducible). Remote archaeology preserved locally (`feat/chat-and-community@8bbfea2` etc.), GitHub gradually clean.

Next P0/P1 after `5976a96`: `fix/leadership-authz` already shipped, next is `fix/renew-guard` (done) — remaining is `concurrent admission` (partySize) and full `chat` WS upgrade, each as isolated PR.

---

## Contributing

One invariant per PR, `fresh DB → migrate deploy → 34 tables → tsc 0 → 42/42` without `db push`, `git diff` must show no `migrations_legacy`/`AccessGrant`/`?token=`/`ACTIVE` enum.

## License

Private — Strato Techcorp / Fortune Group.
