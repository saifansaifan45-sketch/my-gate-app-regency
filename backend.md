# Backend — V0.0.1 Production Architecture

> **Stack:** Node 20 + Express + TypeScript + Prisma 7.9 + PostgreSQL 16. **34 tables** via `2 migrations` (`migrate deploy ONLY`, never `db push`). `42/42` Jest, `header` auth.

## Runtime

- **Framework:** Express, `trust proxy` aware, `CORS` allowlist (`CORS_ALLOWED_ORIGINS`), `express-rate-limit` (`authLimiter`/`loginLimiter` `ip:email` + `skipSuccessfulRequests`, `registerLimiter`).
- **Language:** TypeScript strict, `tsc --noEmit` 0, `exactOptionalPropertyTypes` aware.

## Database & Prisma

- **DB:** PostgreSQL 16, `34 tables` (`33` + `_prisma_migrations`), `PermanentPass` present via forward migration `20260912084413_add_permanent_pass` (no history rewrite of `20260826093513_initial_schema`).
- **Schema:** `User` → `Membership` (user+community+role+status) → `UnitOwnership`/`UnitResidency` → `HouseholdMember` (ACTIVE/PAUSED/REVOKED) → `PermanentPass` (`householdMemberId`, status `ACTIVE/PAUSED/REVOKED/EXPIRED`, `validUntil` + indexes).
- **Visitor:** `Visitor: PENDING→APPROVED→CHECKED_IN→CHECKED_OUT + EXPIRED/REVOKED/REJECTED`, `purpose` required (`min 1`), `otp` 6-digit bcrypt, `validUntil` 24h, `reconcileVisitorLifecycle` every 60s.
- **Migrations:** `prisma migrate deploy` on fresh DB → `2 applied` → `34 tables` → `to_regclass PermanentPass` → `42/42`. **Never** `db push` (masks drift).
- **Client:** `npx prisma generate` (v7.9.1), `adapter-pg`.

## Auth & Sessions

- **JWT:** `generateTokens(user.id, tokenVersion)` → `accessToken` short-lived + `refreshToken` bcrypt-hashed in `Session` (7d, `tokenVersion` checked in `middleware/auth.ts:49`).
- **LoginSecurity:** In-memory `Map` (prod TODO Redis) `maxAttemptsBeforeLockout 5` / `lockout 15m` / `captchaThreshold 3` (`loginSecurity.ts:5`), `delayMs` computed but unenforced — P1 to harden.
- **Rate limit:** `loginLimiter` `10/15m` per `ip:email`, `authLimiter` `30/15m`, `registerLimiter` `5/h`.

## Domain Invariants (proven, not claimed)

- `PATCH /household/members/:id/status REVOKED/PAUSED` → `prisma.$transaction`: `member` + `PermanentPass.updateMany where householdMemberId + status ACTIVE → REVOKED/PAUSED` (`household.ts:257`).
- `POST /household/permanent-passes/:id/renew` → guard `linkedMember.status === ACTIVE` else `400` (`household.ts:443`).
- `POST /visitors/permanent-pass/:passId/check-in` → `status ACTIVE` + `validUntil` + `verifySecurityMembership` (WORKFORCE+SECURITY) → `404` cross-community, `400` not active.
- `POST /visitors` → `purpose` required (`visitors.ts:37` `min 1`), `GUEST` → OTP `6-digit` + `reconcile` before gate.

## Authorization (strict)

- `requireAuth` → `tokenVersion` check.
- `requireLeadership` → **strict** `LEADERSHIP + APPROVED` only (fallback `MANAGER/WORKFORCE/RESIDENT/OWNER → next()` removed `middleware/auth.ts:104`).
- `requireWorkforce` → `WORKFORCE/MANAGER/LEADERSHIP` + `Personnel.employmentStatus !== TERMINATED`.
- `requireVerifiedResidence` → `ACTIVE` residency/ownership **or** `MANAGER/LEADERSHIP` membership.
- `requireWorkforceOrManager` = `requireWorkforce` (gate).
- Cross-tenant isolation: `communityId` scoping, `404` not `403` for invisibility.

## API Conventions

- **Routes:** `REST` `/auth`, `/household`, `/visitors`, `/visitors/permanent-pass/:passId/check-in`, `/chat` (header `Authorization: Bearer`, never `?token=`), `/community`, `/manager`, `/work`, `/leadership`.
- **Validation:** `Zod` `min 1` for `purpose`, `trim` everywhere.
- **Audit:** `AuditLog` (`VISITOR_EXPIRED`, `VISITOR_CHECK_IN`, `handoff`), `IdempotencyKey`.

## Security

- `bcrypt` OTP/tokens, `tokenVersion` rotation on password change.
- `rateLimit` + `loginSecurity` Map, `CORS` allowlist, `Zod` + `sanitizeVisitor` (otp stripped).
- **Remaining P0:** `renew` already fixed, next is `concurrent admission` (`partySize` → `admittedCount` transactional).

## V0.0.1 Gate

```bash
npx prisma generate && npx prisma migrate deploy # 34 tables
npx tsc --noEmit # 0
npx jest tests/visitors.test.ts ... tests/chat.test.ts --runInBand # 42/42
```
No `db push`, no `migrations_legacy`, no `AccessGrant`, no `VisitorStatus ACTIVE`.
